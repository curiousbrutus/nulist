import https from 'https'
import crypto from 'crypto'
import { executeQuery } from './oracle'

// Zimbra CalDAV configuration - use getters to ensure env is loaded
const ZIMBRA_HOST = 'webmail.optimed.com.tr'
const ZIMBRA_CALDAV_PORT = 443
const ZIMBRA_ADMIN_PORT = 7071

function getAdminEmail(): string {
    return process.env.ZIMBRA_ADMIN_EMAIL || ''
}

function getAdminPassword(): string {
    return process.env.ZIMBRA_ADMIN_PASSWORD || ''
}

// Cache for admin auth token
let adminAuthToken: string | null = null
let tokenExpiry: number = 0

// Cache for delegated user tokens
const delegateTokenCache = new Map<string, { token: string; expiry: number }>()

export interface ZimbraTask {
    id: string
    uid: string
    title: string
    description?: string
    dueDate?: Date
    status: 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'
    priority: number // 1-9, where 1 is highest
    created: Date
    modified: Date
    organizerEmail?: string
}

export interface ZimbraCreateResult {
    success: boolean
    uid?: string
    taskId?: string
    etag?: string
    error?: string
}

// Get admin auth token for SOAP API
async function getAdminAuthToken(): Promise<string> {
    // Return cached token if still valid
    if (adminAuthToken && Date.now() < tokenExpiry) {
        return adminAuthToken
    }
    
    const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header><context xmlns="urn:zimbra"/></soap:Header>
  <soap:Body>
    <AuthRequest xmlns="urn:zimbraAdmin">
      <account by="name">${getAdminEmail()}</account>
      <password>${getAdminPassword()}</password>
    </AuthRequest>
  </soap:Body>
</soap:Envelope>`
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: ZIMBRA_HOST,
            port: ZIMBRA_ADMIN_PORT,
            path: '/service/admin/soap',
            method: 'POST',
            headers: { 'Content-Type': 'application/soap+xml' },
            rejectUnauthorized: false
        }, (res) => {
            let data = ''
            res.on('data', c => data += c)
            res.on('end', () => {
                const match = data.match(/<authToken[^>]*>([^<]+)<\/authToken>/)
                if (match) {
                    adminAuthToken = match[1]
                    tokenExpiry = Date.now() + 3600000 // 1 hour
                    resolve(adminAuthToken)
                } else {
                    reject(new Error('Admin auth failed'))
                }
            })
        })
        req.on('error', reject)
        req.write(soapBody)
        req.end()
    })
}

// Get delegate auth token for a specific user (cached)
async function getDelegateAuthToken(userEmail: string): Promise<string> {
    // Check cache
    const cached = delegateTokenCache.get(userEmail)
    if (cached && Date.now() < cached.expiry) {
        return cached.token
    }

    try {
        const adminToken = await getAdminAuthToken()
        
        const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>${adminToken}</authToken>
    </context>
  </soap:Header>
  <soap:Body>
    <DelegateAuthRequest xmlns="urn:zimbraAdmin">
      <account by="name">${userEmail}</account>
    </DelegateAuthRequest>
  </soap:Body>
</soap:Envelope>`

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: ZIMBRA_HOST,
                port: ZIMBRA_ADMIN_PORT,
                path: '/service/admin/soap',
                method: 'POST',
                headers: { 'Content-Type': 'application/soap+xml' },
                rejectUnauthorized: false
            }, (res) => {
                let data = ''
                res.on('data', c => data += c)
                res.on('end', () => {
                    const match = data.match(/<authToken[^>]*>([^<]+)<\/authToken>/)
                    if (match) {
                        delegateTokenCache.set(userEmail, {
                            token: match[1],
                            expiry: Date.now() + 3600000 // 1 hour
                        })
                        resolve(match[1])
                    } else {
                        reject(new Error('Delegate auth failed'))
                    }
                })
            })
            req.on('error', reject)
            req.write(soapBody)
            req.end()
        })
    } catch (error) {
        throw error
    }
}

// Get user tasks as JSON using REST API
export async function getZimbraTasksJSON(userEmail: string): Promise<any[]> {
    try {
        const authToken = await getDelegateAuthToken(userEmail)
        
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: ZIMBRA_HOST,
                port: ZIMBRA_CALDAV_PORT, // Using 443 (Webmail port) for REST
                path: `/home/${userEmail}/tasks?fmt=json`,
                method: 'GET',
                headers: { 
                    'Cookie': `ZM_AUTH_TOKEN=${authToken}` 
                },
                rejectUnauthorized: false
            }, (res) => {
                let data = ''
                res.on('data', c => data += c)
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data)
                            // Zimbra REST API returns { "task": [ ... ] } (singular key)
                            const result = json.task || json.tasks || json || []
                            resolve(Array.isArray(result) ? result : [])
                        } catch (e) {
                            console.error('JSON Parse error for user ' + userEmail, e)
                             resolve([]) // Return empty array on parse error to avoid crashing
                        }
                    } else {
                         // reject(new Error(`REST API Error: ${res.statusCode}`))
                         console.error(`REST API failure for ${userEmail}: ${res.statusCode}`)
                         resolve([]) // Return empty to skip but not crash entire loop
                    }
                })
            })
            req.on('error', (err) => {
                console.error('Request error', err)
                resolve([])
            })
            req.end()
        })
    } catch (error) {
        console.error('getZimbraTasksJSON error:', error)
        return []
    }
}

// NeoList status <-> Zimbra SOAP status mapping
export const STATUS_TO_ZIMBRA: Record<string, string> = {
    'pending': 'NEED',
    'in_progress': 'INPR',
    'completed': 'COMP',
    'cancelled': 'CANCELLED',
    'waiting': 'WAITING',
    'deferred': 'DEFERRED'
}

export const ZIMBRA_TO_STATUS: Record<string, string> = {
    'NEED': 'pending',
    'INPR': 'in_progress',
    'COMP': 'completed',
    'CANCELLED': 'cancelled',
    'WAITING': 'waiting',
    'DEFERRED': 'deferred'
}

// Create task via Admin SOAP API (no sharing required)
export async function createZimbraTaskViaAdminAPI(
    userEmail: string,
    task: {
        title: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: boolean
    }
): Promise<ZimbraCreateResult> {
    try {
        const token = await getAdminAuthToken()

        const dueDate = task.due_date
            ? new Date(task.due_date).toISOString().split('T')[0].replace(/-/g, '')
            : new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0].replace(/-/g, '')

        const priorityMap: Record<string, number> = { 'Acil': 1, 'Yüksek': 3, 'Orta': 5, 'Düşük': 9 }
        const priority = priorityMap[task.priority || 'Orta'] || 5

        let taskStatus = STATUS_TO_ZIMBRA[task.status || 'pending'] || 'NEED'
        let percentComplete = '0'
        if (task.is_completed || task.status === 'completed') {
            taskStatus = 'COMP'
            percentComplete = '100'
        }

        const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>${token}</authToken>
      <account by="name">${userEmail}</account>
    </context>
  </soap:Header>
  <soap:Body>
    <CreateTaskRequest xmlns="urn:zimbraMail">
      <m l="15">
        <inv>
          <comp name="${escapeXml(task.title)}" status="${taskStatus}" priority="${priority}" percentComplete="${percentComplete}">
            <s d="${dueDate}"/>
            <e d="${dueDate}"/>
            <or a="${getAdminEmail()}" d="İş Takip"/>
            <desc>${escapeXml(task.notes || '')}</desc>
          </comp>
        </inv>
        <su>${escapeXml(task.title)}</su>
        <mp ct="text/plain">
          <content>${escapeXml(task.notes || '')}</content>
        </mp>
      </m>
    </CreateTaskRequest>
  </soap:Body>
</soap:Envelope>`
        
        return new Promise((resolve) => {
            const req = https.request({
                hostname: ZIMBRA_HOST,
                port: ZIMBRA_ADMIN_PORT,
                path: '/service/admin/soap',
                method: 'POST',
                headers: { 'Content-Type': 'application/soap+xml' },
                rejectUnauthorized: false
            }, (res) => {
                let data = ''
                res.on('data', c => data += c)
                res.on('end', () => {
                    if (res.statusCode === 200 && !data.includes('Fault')) {
                        const idMatch = data.match(/calItemId="([^"]+)"/)
                        const invIdMatch = data.match(/invId="([^"]+)"/)
                        resolve({
                            success: true,
                            taskId: idMatch ? idMatch[1] : undefined,
                            uid: invIdMatch ? invIdMatch[1] : undefined
                        })
                    } else {
                        const fault = data.match(/<soap:Text[^>]*>([^<]+)/)
                        resolve({
                            success: false,
                            error: fault ? fault[1] : 'Unknown SOAP error'
                        })
                    }
                })
            })
            req.on('error', (e) => resolve({ success: false, error: e.message }))
            req.write(soapBody)
            req.end()
        })
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// NeoList status → CalDAV VTODO STATUS mapping
const STATUS_TO_CALDAV: Record<string, string> = {
    'pending': 'NEEDS-ACTION',
    'in_progress': 'IN-PROCESS',
    'completed': 'COMPLETED',
    'cancelled': 'CANCELLED',
    'waiting': 'NEEDS-ACTION',
    'deferred': 'NEEDS-ACTION'
}

// CalDAV HTTP request helper
function caldavHttpRequest(
    method: string,
    path: string,
    userToken: string,
    body?: string,
    extraHeaders?: Record<string, string>
): Promise<{ status: number; headers: Record<string, any>; body: string }> {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: ZIMBRA_HOST,
            port: ZIMBRA_CALDAV_PORT,
            path,
            method,
            headers: {
                'Cookie': `ZM_AUTH_TOKEN=${userToken}`,
                ...(body ? { 'Content-Type': 'text/calendar; charset=utf-8' } : {}),
                ...extraHeaders
            },
            rejectUnauthorized: false,
            timeout: 15000
        }, (res) => {
            let data = ''
            res.on('data', c => data += c)
            res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }))
        })
        req.on('error', (e) => resolve({ status: 0, headers: {}, body: 'ERROR: ' + e.message }))
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: {}, body: 'TIMEOUT' }) })
        if (body) req.write(body)
        req.end()
    })
}

// Get task UID and details via SOAP GetTaskRequest
async function getZimbraTaskDetailsByCalItemId(
    adminToken: string,
    userEmail: string,
    calItemId: string
): Promise<{ uid?: string; name?: string; status?: string; priority?: string; percentComplete?: string; startDate?: string; endDate?: string; description?: string; sequence?: string } | null> {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>${adminToken}</authToken>
      <account by="name">${userEmail}</account>
    </context>
  </soap:Header>
  <soap:Body>
    <GetTaskRequest xmlns="urn:zimbraMail" id="${calItemId}"/>
  </soap:Body>
</soap:Envelope>`

        const req = https.request({
            hostname: ZIMBRA_HOST,
            port: ZIMBRA_ADMIN_PORT,
            path: '/service/admin/soap',
            method: 'POST',
            headers: { 'Content-Type': 'application/soap+xml' },
            rejectUnauthorized: false
        }, (res) => {
            let data = ''
            res.on('data', c => data += c)
            res.on('end', () => {
                if (res.statusCode === 200 && !data.includes('Fault')) {
                    const uid = data.match(/uid="([^"]+)"/)?.[1]
                    const name = data.match(/name="([^"]+)"/)?.[1]
                    const status = data.match(/status="([^"]+)"/)?.[1]
                    const priority = data.match(/priority="([^"]+)"/)?.[1]
                    const percentComplete = data.match(/percentComplete="([^"]+)"/)?.[1]
                    const seq = data.match(/seq="([^"]+)"/)?.[1]
                    const startDate = data.match(/<s d="([^"]+)"/)?.[1]
                    const endDate = data.match(/<e d="([^"]+)"/)?.[1]
                    const desc = data.match(/<desc>([^<]*)<\/desc>/)?.[1]
                    resolve({ uid, name, status, priority, percentComplete, startDate: startDate, endDate, description: desc, sequence: seq })
                } else {
                    resolve(null)
                }
            })
        })
        req.on('error', () => resolve(null))
        req.write(soapBody)
        req.end()
    })
}

// Parse VTODO properties from iCalendar text
function parseVtodoProperties(vtodoText: string): Record<string, string> {
    const props: Record<string, string> = {}
    const lines = vtodoText.replace(/\r\n /g, '').split(/\r?\n/)
    for (const line of lines) {
        const match = line.match(/^([A-Z-]+)[;:](.*)$/)
        if (match) {
            // Strip parameters for property name (e.g., DTSTART;VALUE=DATE → DTSTART)
            const propName = match[1].split(';')[0]
            props[propName] = match[2]
        }
    }
    return props
}

// Update task via CalDAV PUT (preserves calItemId - no stale IDs)
async function updateTaskViaCalDAV(
    userEmail: string,
    zimbraTaskId: string,
    updates: {
        title?: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Get delegated user token for CalDAV
        const userToken = await getDelegateAuthToken(userEmail)

        // 2. Resolve VTODO UID - try direct CalDAV GET first (works if zimbraTaskId is already a UID)
        let uid = zimbraTaskId
        let getResult = await caldavHttpRequest('GET', `/dav/${userEmail}/Tasks/${uid}.ics`, userToken)

        if (getResult.status !== 200 && zimbraTaskId.includes(':')) {
            // If failed and ID has colon (calItemId format), look up UID via SOAP
            const adminToken = await getAdminAuthToken()
            const taskDetails = await getZimbraTaskDetailsByCalItemId(adminToken, userEmail, zimbraTaskId)
            if (!taskDetails?.uid) {
                return { success: false, error: 'Could not resolve task UID' }
            }
            uid = taskDetails.uid
            getResult = await caldavHttpRequest('GET', `/dav/${userEmail}/Tasks/${uid}.ics`, userToken)
        }

        if (getResult.status !== 200) {
            return { success: false, error: `CalDAV GET failed: ${getResult.status}` }
        }
        const etag = getResult.headers['etag']
        if (!etag) {
            return { success: false, error: 'No ETag in CalDAV response' }
        }

        // 3. Parse existing VTODO to get current values
        const existingProps = parseVtodoProperties(getResult.body)
        const existingTitle = existingProps['SUMMARY'] || 'Untitled Task'
        const existingPriority = existingProps['PRIORITY'] || '5'
        const existingStatus = existingProps['STATUS'] || 'NEEDS-ACTION'
        const existingPercent = existingProps['PERCENT-COMPLETE'] || '0'
        const existingSeq = existingProps['SEQUENCE'] || '0'
        // Extract date from VALUE=DATE:YYYYMMDD format
        const existingDue = existingProps['DUE']?.replace(/^VALUE=DATE:/, '') || existingProps['DTSTART']?.replace(/^VALUE=DATE:/, '') || ''
        // Description might contain escaped chars
        const existingDesc = existingProps['DESCRIPTION']?.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\') || ''

        // 4. Merge updates with existing data
        const priorityMap: Record<string, number> = { 'Acil': 1, 'Yüksek': 3, 'Orta': 5, 'Düşük': 9 }
        const reversePriorityMap: Record<string, string> = { '1': 'Acil', '3': 'Yüksek', '5': 'Orta', '9': 'Düşük' }

        const finalTitle = updates.title || existingTitle
        const finalPriority = updates.priority ? (priorityMap[updates.priority] || 5) : parseInt(existingPriority)
        const finalDescription = updates.notes !== undefined ? updates.notes : existingDesc

        // Status: updates take precedence
        let caldavStatus = existingStatus
        let percentComplete = existingPercent
        if (updates.is_completed || updates.status === 'completed') {
            caldavStatus = 'COMPLETED'
            percentComplete = '100'
        } else if (updates.status) {
            caldavStatus = STATUS_TO_CALDAV[updates.status] || 'NEEDS-ACTION'
            percentComplete = updates.status === 'in_progress' ? '50' : '0'
        }

        // Due date
        let dueDate = existingDue
        if (updates.due_date) {
            dueDate = new Date(updates.due_date).toISOString().split('T')[0].replace(/-/g, '')
        }

        const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        const seq = parseInt(existingSeq) + 1

        const escapeIcal = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

        // 5. Build VTODO
        let vtodo = `BEGIN:VCALENDAR\r\nPRODID:Zimbra-Calendar-Provider\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:${uid}\r\nSUMMARY:${escapeIcal(finalTitle)}\r\nPRIORITY:${finalPriority}\r\nPERCENT-COMPLETE:${percentComplete}\r\nORGANIZER;CN="İş Takip":mailto:${getAdminEmail()}\r\n`
        if (dueDate) {
            vtodo += `DTSTART;VALUE=DATE:${dueDate}\r\nDUE;VALUE=DATE:${dueDate}\r\n`
        }
        if (finalDescription) {
            vtodo += `DESCRIPTION:${escapeIcal(finalDescription)}\r\n`
        }
        vtodo += `STATUS:${caldavStatus}\r\nCLASS:PUBLIC\r\nLAST-MODIFIED:${now}\r\nDTSTAMP:${now}\r\nSEQUENCE:${seq}\r\nEND:VTODO\r\nEND:VCALENDAR`

        // 6. PUT modified VTODO
        const putResult = await caldavHttpRequest(
            'PUT',
            `/dav/${userEmail}/Tasks/${uid}.ics`,
            userToken,
            vtodo,
            { 'If-Match': etag }
        )

        if (putResult.status === 204 || putResult.status === 200) {
            return { success: true }
        }
        return { success: false, error: `CalDAV PUT failed: ${putResult.status} ${putResult.body.substring(0, 200)}` }
    } catch (error) {
        return { success: false, error: `CalDAV error: ${(error as Error).message}` }
    }
}

// Update task via Admin SOAP API
export async function updateZimbraTaskViaAdminAPI(
    userEmail: string,
    zimbraTaskId: string,
    updates: {
        title?: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: boolean
    }
): Promise<{ success: boolean; error?: string; newTaskId?: string }> {
    try {
        // Try CalDAV update first (preserves calItemId - no stale IDs in webmail)
        const caldavResult = await updateTaskViaCalDAV(userEmail, zimbraTaskId, updates)
        if (caldavResult.success) {
            return { success: true } // No newTaskId because calItemId is preserved
        }

        console.log(`CalDAV update failed for ${zimbraTaskId}, falling back to delete+recreate: ${caldavResult.error}`)

        // Fallback: delete old task, create new one
        await deleteZimbraTaskViaAdminAPI(userEmail, zimbraTaskId)

        const createResult = await createZimbraTaskViaAdminAPI(userEmail, {
            title: updates.title || 'Untitled Task',
            notes: updates.notes,
            due_date: updates.due_date,
            priority: updates.priority,
            status: updates.status,
            is_completed: updates.is_completed
        })

        if (createResult.success) {
            const newId = createResult.taskId || createResult.uid
            return { success: true, newTaskId: newId }
        } else {
            return { success: false, error: createResult.error }
        }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Delete task via Admin SOAP API
export async function deleteZimbraTaskViaAdminAPI(
    userEmail: string,
    zimbraTaskId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const token = await getAdminAuthToken()
        
        const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>${token}</authToken>
      <account by="name">${userEmail}</account>
    </context>
  </soap:Header>
  <soap:Body>
    <ItemActionRequest xmlns="urn:zimbraMail">
      <action id="${zimbraTaskId}" op="delete"/>
    </ItemActionRequest>
  </soap:Body>
</soap:Envelope>`
        
        return new Promise((resolve) => {
            const req = https.request({
                hostname: ZIMBRA_HOST,
                port: ZIMBRA_ADMIN_PORT,
                path: '/service/admin/soap',
                method: 'POST',
                headers: { 'Content-Type': 'application/soap+xml' },
                rejectUnauthorized: false
            }, (res) => {
                let data = ''
                res.on('data', c => data += c)
                res.on('end', () => {
                   if (res.statusCode === 200 && !data.includes('Fault')) {
                        resolve({ success: true })
                    } else {
                        const fault = data.match(/<soap:Text[^>]*>([^<]+)/)
                        resolve({ success: false, error: fault ? fault[1] : 'Unknown SOAP error' })
                    }
                })
            })
            req.on('error', (e) => resolve({ success: false, error: e.message }))
            req.write(soapBody)
            req.end()
        })
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Get task via Admin SOAP API
export async function getZimbraTaskViaAdminAPI(
    userEmail: string,
    zimbraTaskId: string
): Promise<{ success: boolean; task?: any; error?: string }> {
    try {
        const token = await getAdminAuthToken()
        
        const soapBody = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <context xmlns="urn:zimbra">
      <authToken>${token}</authToken>
      <account by="name">${userEmail}</account>
    </context>
  </soap:Header>
  <soap:Body>
    <GetMsgRequest xmlns="urn:zimbraMail">
      <m id="${zimbraTaskId}" />
    </GetMsgRequest>
  </soap:Body>
</soap:Envelope>`
        
        return new Promise((resolve) => {
            const req = https.request({
                hostname: ZIMBRA_HOST,
                port: ZIMBRA_ADMIN_PORT,
                path: '/service/admin/soap',
                method: 'POST',
                headers: { 'Content-Type': 'application/soap+xml' },
                rejectUnauthorized: false
            }, (res) => {
                let data = ''
                res.on('data', c => data += c)
                res.on('end', () => {
                   if (res.statusCode === 200 && !data.includes('Fault')) {
                        // Parse status and percentage
                        // <comp ... status="COMP" percentComplete="100" ...>
                        const statusMatch = data.match(/status="([^"]+)"/)
                        const percentMatch = data.match(/percentComplete="([^"]+)"/)
                        const subjectMatch = data.match(/<su>([^<]+)<\/su>/)
                        
                        resolve({
                            success: true,
                            task: {
                                status: statusMatch ? statusMatch[1] : undefined,
                                percentComplete: percentMatch ? parseInt(percentMatch[1]) : 0,
                                title: subjectMatch ? subjectMatch[1] : undefined
                            }
                        })
                    } else {
                        const fault = data.match(/<soap:Text[^>]*>([^<]+)/)
                        resolve({ success: false, error: fault ? fault[1] : 'Unknown SOAP error' })
                    }
                })
            })
            req.on('error', (e) => resolve({ success: false, error: e.message }))
            req.write(soapBody)
            req.end()
        })
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Helper to escape XML special characters
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// Make CalDAV request
async function makeCalDAVRequest(
    path: string,
    method: 'GET' | 'PUT' | 'DELETE' | 'PROPFIND' | 'REPORT',
    body?: string,
    headers?: Record<string, string>
): Promise<{ statusCode: number; headers: Record<string, any>; body: string }> {
    const auth = Buffer.from(`${getAdminEmail()}:${getAdminPassword()}`).toString('base64')
    
    return new Promise((resolve, reject) => {
        const requestHeaders: Record<string, string | number> = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': headers?.['Content-Type'] || 'application/xml',
            ...headers
        }
        
        if (body) {
            requestHeaders['Content-Length'] = Buffer.byteLength(body)
        }
        
        const options: https.RequestOptions = {
            hostname: ZIMBRA_HOST,
            port: ZIMBRA_CALDAV_PORT,
            path: encodeURI(path),
            method: method,
            headers: requestHeaders,
            rejectUnauthorized: false,
            timeout: 15000
        }
        
        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers as Record<string, any>,
                    body: data
                })
            })
        })
        
        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })
        
        if (body) {
            req.write(body)
        }
        req.end()
    })
}

// Check if user has Zimbra sync enabled and shared their Tasks
export async function checkZimbraAccess(userEmail: string): Promise<boolean> {
    try {
        const result = await makeCalDAVRequest(
            `/dav/${userEmail}/Tasks/`,
            'PROPFIND',
            `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:displayname/></d:prop>
</d:propfind>`,
            { 'Depth': '0' }
        )
        return result.statusCode === 207
    } catch {
        return false
    }
}

// Authenticate user with their own Zimbra credentials
export async function authenticateWithZimbra(email: string, password: string): Promise<boolean> {
    // Try multiple Zimbra CalDAV paths
    const paths = [
        `/dav/${email}/Tasks/`,
        `/dav/${email}/`,
        `/service/dav/${email}/Tasks/`,
        `/caldav/${email}/Tasks/`
    ]
    
    for (const path of paths) {
        const result = await tryZimbraAuth(email, password, path)
        if (result) return true
    }
    return false
}

async function tryZimbraAuth(email: string, password: string, path: string): Promise<boolean> {
    return new Promise((resolve) => {
        const auth = Buffer.from(`${email}:${password}`).toString('base64')
        
        const req = https.request({
            hostname: ZIMBRA_HOST,
            port: ZIMBRA_CALDAV_PORT,
            path: path,
            method: 'PROPFIND',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/xml',
                'Depth': '0'
            },
            rejectUnauthorized: false,
            timeout: 10000
        }, (res) => {
            // 207 Multi-Status = success, 401/404 = bad credentials or wrong path
            console.log(`Zimbra auth for ${email} at ${path}: status ${res.statusCode}`)
            resolve(res.statusCode === 207 || res.statusCode === 200)
        })
        
        req.on('error', (err) => {
            console.error(`Zimbra auth error for ${email} at ${path}:`, err.message)
            resolve(false)
        })
        
        req.on('timeout', () => {
            console.error(`Zimbra auth timeout for ${email} at ${path}`)
            req.destroy()
            resolve(false)
        })
        
        req.write(`<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:displayname/></d:prop>
</d:propfind>`)
        req.end()
    })
}

// Convert NeoList task to VTODO (iCalendar format)
export function taskToVTODO(task: {
    id: string
    title: string
    notes?: string
    due_date?: string | Date
    is_completed?: number
    status?: string
    priority?: string
    created_at?: string | Date
    branch?: string
    meeting_type?: string
}, organizerEmail?: string): string {
    const uid = task.id || crypto.randomUUID()
    const now = new Date()
    const dtStamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    
    // Due date
    let dueLine = ''
    if (task.due_date) {
        const dueDate = new Date(task.due_date)
        const dueDateStr = dueDate.toISOString().split('T')[0].replace(/-/g, '')
        dueLine = `DUE:${dueDateStr}\n`
    }
    
    // Status mapping
    let status = 'NEEDS-ACTION'
    if (task.is_completed === 1) {
        status = 'COMPLETED'
    } else if (task.status === 'in_progress') {
        status = 'IN-PROCESS'
    } else if (task.status === 'cancelled') {
        status = 'CANCELLED'
    } else if (task.status === 'waiting') {
        status = 'WAITING'
    } else if (task.status === 'deferred') {
        status = 'DEFERRED'
    }
    
    // Priority mapping: Acil=1, Yüksek=3, Orta=5, Düşük=9
    const priorityMap: Record<string, number> = {
        'Acil': 1,
        'Yüksek': 3,
        'Orta': 5,
        'Düşük': 9
    }
    const priority = priorityMap[task.priority || 'Orta'] || 5
    
    // Created date
    let createdLine = ''
    if (task.created_at) {
        const createdDate = new Date(task.created_at)
        const createdStr = createdDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        createdLine = `CREATED:${createdStr}\n`
    }
    
    // Custom properties
    let customProps = ''
    if (task.branch) {
        customProps += `X-NEOLIST-BRANCH:${task.branch}\n`
    }
    if (task.meeting_type) {
        customProps += `X-NEOLIST-MEETING-TYPE:${task.meeting_type}\n`
    }
    
    // Organizer
    const organizerLine = organizerEmail ? `ORGANIZER:mailto:${organizerEmail}\n` : ''
    
    // Escape special characters in text
    const escapeText = (text: string) => {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n')
    }
    
    const description = task.notes ? `DESCRIPTION:${escapeText(task.notes)}\n` : ''
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Optimed//Wunderlist-Oracle//TR
BEGIN:VTODO
UID:${uid}
DTSTAMP:${dtStamp}
${dueLine}SUMMARY:${escapeText(task.title)}
${description}STATUS:${status}
PRIORITY:${priority}
${createdLine}LAST-MODIFIED:${dtStamp}
${organizerLine}${customProps}END:VTODO
END:VCALENDAR`.replace(/\n+/g, '\n')
}

// Parse VTODO back to NeoList task format
export function vtodoToTask(vtodoString: string): ZimbraTask | null {
    try {
        // Simple parsing without external library
        const getProperty = (name: string): string | undefined => {
            const regex = new RegExp(`${name}[;:]([^\\r\\n]+)`, 'i')
            const match = vtodoString.match(regex)
            return match ? match[1].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';') : undefined
        }
        
        const uid = getProperty('UID')
        const summary = getProperty('SUMMARY')
        
        if (!uid || !summary) return null
        
        const description = getProperty('DESCRIPTION')
        const due = getProperty('DUE')
        const status = (getProperty('STATUS') || 'NEEDS-ACTION') as ZimbraTask['status']
        const priority = parseInt(getProperty('PRIORITY') || '5', 10)
        const created = getProperty('CREATED')
        const modified = getProperty('LAST-MODIFIED')
        const organizer = getProperty('ORGANIZER')
        
        // Parse date strings (YYYYMMDD or full ISO)
        const parseDate = (dateStr?: string): Date | undefined => {
            if (!dateStr) return undefined
            if (dateStr.length === 8) {
                return new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`)
            }
            return new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'))
        }
        
        return {
            id: uid,
            uid: uid,
            title: summary,
            description: description,
            dueDate: parseDate(due),
            status: status,
            priority: priority,
            created: parseDate(created) || new Date(),
            modified: parseDate(modified) || new Date(),
            organizerEmail: organizer?.replace('mailto:', '')
        }
    } catch (error) {
        console.error('Error parsing VTODO:', error)
        return null
    }
}

// Create a task in user's Zimbra Tasks folder
// Uses Admin SOAP API directly (no CalDAV sharing required)
export async function createZimbraTask(
    userEmail: string,
    task: {
        id?: string
        title: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: number
    }
): Promise<ZimbraCreateResult> {
    // Go directly to Admin SOAP API - no CalDAV sharing needed
    return createZimbraTaskViaAdminAPI(userEmail, {
        ...task,
        is_completed: task.is_completed !== undefined ? Boolean(task.is_completed) : undefined
    })
}

// Update a task in user's Zimbra Tasks folder
// Uses Admin SOAP API directly with the calItemId
export async function updateZimbraTask(
    userEmail: string,
    zimbraTaskId: string,
    task: {
        title?: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: number
    }
): Promise<ZimbraCreateResult> {
    const result = await updateZimbraTaskViaAdminAPI(userEmail, zimbraTaskId, {
        title: task.title,
        notes: task.notes,
        due_date: task.due_date,
        priority: task.priority,
        is_completed: task.is_completed !== undefined ? Boolean(task.is_completed) : undefined
    })
    return { success: result.success, error: result.error }
}

// Delete a task from user's Zimbra Tasks folder
// Uses Admin SOAP API directly
export async function deleteZimbraTask(
    userEmail: string,
    zimbraTaskId: string
): Promise<{ success: boolean; error?: string }> {
    return deleteZimbraTaskViaAdminAPI(userEmail, zimbraTaskId)
}

// Get all tasks from user's Zimbra Tasks folder
export async function getZimbraTasks(userEmail: string): Promise<{ success: boolean; tasks?: ZimbraTask[]; error?: string }> {
    try {
        const result = await makeCalDAVRequest(
            `/dav/${userEmail}/Tasks/`,
            'PROPFIND',
            `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
</d:propfind>`,
            { 'Depth': '1' }
        )
        
        if (result.statusCode !== 207) {
            return { success: false, error: `Failed to fetch tasks: ${result.statusCode}` }
        }
        
        const tasks: ZimbraTask[] = []
        const calendarDataMatches = result.body.match(/<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/gi)
        
        if (calendarDataMatches) {
            for (const match of calendarDataMatches) {
                const calendarData = match.replace(/<[^>]+>/g, '')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                
                if (calendarData.includes('VTODO')) {
                    const task = vtodoToTask(calendarData)
                    if (task) {
                        tasks.push(task)
                    }
                }
            }
        }
        
        return { success: true, tasks }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Sync tasks from NeoList to Zimbra for a specific user
export async function syncTasksToZimbra(userEmail: string, userId: string): Promise<{
    success: boolean
    synced: number
    failed: number
    total: number
    errors?: string[]
}> {
    try {
        // Get user's active tasks
        const tasks = await executeQuery(
            `SELECT t.id, t.title, t.notes, t.due_date, t.is_completed, t.status, 
                    t.priority, t.created_at, t.branch, t.meeting_type
             FROM tasks t
             JOIN task_assignees ta ON t.id = ta.task_id
             WHERE ta.user_id = :user_id
             ORDER BY t.created_at DESC`,
            { user_id: userId },
            userId
        )

        if (!tasks || tasks.length === 0) {
            console.log(`No tasks to sync for user ${userEmail}`)
            return { success: true, synced: 0, failed: 0, total: 0 }
        }

        let syncedCount = 0
        let failedCount = 0
        const errors: string[] = []

        // Sync each task
        for (const task of tasks) {
            const result = await createZimbraTask(userEmail, {
                id: task.ID,
                title: task.TITLE,
                notes: task.NOTES,
                due_date: task.DUE_DATE,
                priority: task.PRIORITY,
                status: task.STATUS,
                is_completed: task.IS_COMPLETED
            })
            
            if (result.success) {
                syncedCount++
            } else {
                failedCount++
                errors.push(`Task ${task.ID}: ${result.error}`)
            }
        }

        return {
            success: failedCount === 0,
            synced: syncedCount,
            failed: failedCount,
            total: tasks.length,
            errors: errors.length > 0 ? errors : undefined
        }
    } catch (error) {
        console.error('Error syncing tasks to Zimbra:', error)
        return {
            success: false,
            synced: 0,
            failed: 0,
            total: 0,
            errors: [(error as Error).message]
        }
    }
}

// Sync tasks from Zimbra to NeoList for a specific user
export async function syncTasksFromZimbra(userEmail: string, userId: string): Promise<{
    success: boolean
    tasks?: ZimbraTask[]
    error?: string
}> {
    try {
        const result = await getZimbraTasks(userEmail)
        
        if (!result.success) {
            return { success: false, error: result.error }
        }

        // TODO: Update NeoList database with changes from Zimbra
        // This requires comparing modified timestamps and applying updates

        return { success: true, tasks: result.tasks }
    } catch (error) {
        console.error('Error syncing tasks from Zimbra:', error)
        return { success: false, error: (error as Error).message }
    }
}

// Sync a single task when it's created/updated in NeoList
export async function syncSingleTaskToZimbra(
    userEmail: string,
    taskId: string,
    task: {
        title: string
        notes?: string
        due_date?: string | Date
        priority?: string
        status?: string
        is_completed?: number
    },
    action: 'create' | 'update' | 'delete' = 'create'
): Promise<ZimbraCreateResult> {
    if (action === 'delete') {
        const result = await deleteZimbraTask(userEmail, taskId)
        return { success: result.success, error: result.error }
    }

    return createZimbraTask(userEmail, { ...task, id: taskId })
}
