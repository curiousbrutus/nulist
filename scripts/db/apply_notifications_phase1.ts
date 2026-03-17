import dotenv from 'dotenv'
import path from 'path'
import { closePool, executeNonQuery, initializePool } from '../../src/lib/oracle'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const statements = [
    `CREATE TABLE notif_events (
        id VARCHAR2(64) PRIMARY KEY,
        event_type VARCHAR2(50) NOT NULL,
        task_id VARCHAR2(64),
        actor_user_id VARCHAR2(64),
        payload CLOB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX idx_notif_evt_type_created ON notif_events(event_type, created_at)`,
    `CREATE INDEX idx_notif_evt_task_created ON notif_events(task_id, created_at)`,

    `CREATE TABLE notif_user_prefs (
        id VARCHAR2(64) PRIMARY KEY,
        user_id VARCHAR2(64) NOT NULL,
        telegram_enabled NUMBER(1) DEFAULT 1 NOT NULL,
        email_enabled NUMBER(1) DEFAULT 1 NOT NULL,
        in_app_enabled NUMBER(1) DEFAULT 1 NOT NULL,
        daily_summary_enabled NUMBER(1) DEFAULT 1 NOT NULL,
        daily_summary_hour NUMBER(2) DEFAULT 9 NOT NULL,
        timezone VARCHAR2(64) DEFAULT 'Europe/Istanbul' NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT uk_notif_user_prefs_user UNIQUE (user_id),
        CONSTRAINT chk_unp_telegram_enabled CHECK (telegram_enabled IN (0, 1)),
        CONSTRAINT chk_unp_email_enabled CHECK (email_enabled IN (0, 1)),
        CONSTRAINT chk_unp_in_app_enabled CHECK (in_app_enabled IN (0, 1)),
        CONSTRAINT chk_unp_daily_summary_enabled CHECK (daily_summary_enabled IN (0, 1)),
        CONSTRAINT chk_unp_daily_summary_hour CHECK (daily_summary_hour BETWEEN 0 AND 23)
    )`,

    `CREATE TABLE notif_deliveries (
        id VARCHAR2(64) PRIMARY KEY,
        event_id VARCHAR2(64) NOT NULL,
        user_id VARCHAR2(64) NOT NULL,
        channel VARCHAR2(20) NOT NULL,
        status VARCHAR2(20) DEFAULT 'PENDING' NOT NULL,
        retry_count NUMBER DEFAULT 0 NOT NULL,
        idempotency_key VARCHAR2(255),
        last_error CLOB,
        sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fk_notif_deliv_event FOREIGN KEY (event_id) REFERENCES notif_events(id) ON DELETE CASCADE,
        CONSTRAINT chk_nd_channel CHECK (channel IN ('telegram', 'email', 'in_app')),
        CONSTRAINT chk_nd_status CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED'))
    )`,
    `CREATE UNIQUE INDEX uq_notif_deliv_idempotency ON notif_deliveries(idempotency_key)`,
    `CREATE INDEX idx_notif_deliv_status_created ON notif_deliveries(status, created_at)`,
    `CREATE INDEX idx_notif_deliv_user_status ON notif_deliveries(user_id, status)`,

    `CREATE TABLE inapp_notifications (
        id VARCHAR2(64) PRIMARY KEY,
        user_id VARCHAR2(64) NOT NULL,
        event_id VARCHAR2(64),
        title VARCHAR2(255) NOT NULL,
        body CLOB,
        is_read NUMBER(1) DEFAULT 0 NOT NULL,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fk_inapp_notif_event FOREIGN KEY (event_id) REFERENCES notif_events(id) ON DELETE SET NULL,
        CONSTRAINT chk_iap_is_read CHECK (is_read IN (0, 1))
    )`,
    `CREATE INDEX idx_inapp_notif_user_read_cr ON inapp_notifications(user_id, is_read, created_at)`
]

async function main() {
    await initializePool()

    for (const statement of statements) {
        try {
            await executeNonQuery(statement)
            console.log('✓ Applied:', statement.split('\n')[0])
        } catch (error: any) {
            const message = String(error?.message || '')
            if (message.includes('ORA-00955') || message.includes('already exists') || message.includes('ORA-01408')) {
                console.log('↷ Skipped existing:', statement.split('\n')[0])
                continue
            }
            throw error
        }
    }

    console.log('✅ Notification phase-1 schema ready')
}

main()
    .catch((error) => {
        console.error('❌ apply_notifications_phase1 failed:', error)
        process.exit(1)
    })
    .finally(async () => {
        await closePool()
    })
