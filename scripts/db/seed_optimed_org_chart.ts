import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const facilities = ['Çorlu', 'Çerkezköy', 'Kapaklı']

const departments = [
  'Bilgi Teknolojileri',
  'Teknik Hizmetler',
  'Uluslararası Hasta Hizmetleri',
  'İdari Tıbbi Sekreterlik',
  'Resmi Kurum Süreçleri ve Denetimleri',
  'Hemşirelik Hizmetleri',
  'Mali İşler ve Finans',
  'Genel Muhasebe ve Finans',
  'Medikal Muhasebe ve Anlaşmalı Kurumlar',
  'Stok Yönetimi',
  'Hasta Hizmetleri ve Kurumsal İletişim',
  'Kurumsal Pazarlama',
  'Çağrı Merkezi',
  'Basın Yayın',
  'Hasta Hizmetleri',
  'İnsan Kaynakları ve Eğitim',
  'Satın Alma',
  'Kalite',
  'İSG',
  'Arşiv',
  'İş Geliştirme',
  'Yönetim Asistanlığı'
]

async function getOrCreateFacility(connection: any, name: string) {
  const existing = await connection.execute(
    `SELECT id FROM facilities WHERE UPPER(TRIM(name)) = UPPER(TRIM(:name))`,
    { name },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  )

  if ((existing.rows || []).length > 0) {
    return (existing.rows?.[0] as any).ID || (existing.rows?.[0] as any).id
  }

  const id = `fac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const code = name.toUpperCase().replace(/\s+/g, '_').replace(/Ç/g, 'C').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ü/g, 'U')

  await connection.execute(
    `INSERT INTO facilities (id, code, name, timezone, is_active)
     VALUES (:id, :code, :name, 'Europe/Istanbul', 1)`,
    { id, code, name },
    { autoCommit: false }
  )

  return id
}

async function ensureDepartment(connection: any, facilityId: string, departmentName: string) {
  const existing = await connection.execute(
    `SELECT id FROM departments
     WHERE facility_id = :facility_id
       AND UPPER(TRIM(name)) = UPPER(TRIM(:name))`,
    { facility_id: facilityId, name: departmentName },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  )

  if ((existing.rows || []).length > 0) {
    return false
  }

  const id = `dept_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  await connection.execute(
    `INSERT INTO departments (id, facility_id, name, is_active)
     VALUES (:id, :facility_id, :name, 1)`,
    { id, facility_id: facilityId, name: departmentName },
    { autoCommit: false }
  )

  return true
}

async function main() {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectionString: process.env.ORACLE_CONN_STRING || process.env.ORACLE_CONNECTION_STRING
  })

  try {
    let insertedFacilities = 0
    let insertedDepartments = 0

    for (const facilityName of facilities) {
      const before = await connection.execute(
        `SELECT COUNT(*) AS c FROM facilities WHERE UPPER(TRIM(name)) = UPPER(TRIM(:name))`,
        { name: facilityName },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      )
      const existed = Number((before.rows?.[0] as any)?.C || (before.rows?.[0] as any)?.c || 0) > 0

      const facilityId = await getOrCreateFacility(connection, facilityName)
      if (!existed) insertedFacilities += 1

      for (const departmentName of departments) {
        const added = await ensureDepartment(connection, facilityId, departmentName)
        if (added) insertedDepartments += 1
      }
    }

    await connection.commit()

    const facilityCount = await connection.execute(
      `SELECT COUNT(*) AS c FROM facilities`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    )

    const departmentCount = await connection.execute(
      `SELECT COUNT(*) AS c FROM departments`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    )

    console.log(JSON.stringify({
      insertedFacilities,
      insertedDepartments,
      facilitiesTotal: Number((facilityCount.rows?.[0] as any)?.C || (facilityCount.rows?.[0] as any)?.c || 0),
      departmentsTotal: Number((departmentCount.rows?.[0] as any)?.C || (departmentCount.rows?.[0] as any)?.c || 0)
    }, null, 2))
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
