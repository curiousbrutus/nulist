BEGIN
    -- Create sync_queue table if it doesn't exist
    BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE sync_queue (
            id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
            task_id VARCHAR2(36) NOT NULL,
            user_email VARCHAR2(255) NOT NULL,
            action_type VARCHAR2(20) NOT NULL,
            payload CLOB,
            status VARCHAR2(20) DEFAULT ''PENDING'',
            retry_count NUMBER DEFAULT 0,
            error_message CLOB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT pk_sync_queue PRIMARY KEY (id),
            CONSTRAINT chk_sync_action CHECK (action_type IN (''CREATE'', ''UPDATE'', ''DELETE'')),
            CONSTRAINT chk_sync_status CHECK (status IN (''PENDING'', ''PROCESSING'', ''COMPLETED'', ''FAILED''))
        )';
    EXCEPTION WHEN OTHERS THEN
        -- ORA-00955: name is already used by an existing object
        IF SQLCODE != -955 THEN RAISE; END IF;
    END;

    -- Create index on status and created_at
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_sync_queue_status_created ON sync_queue(status, created_at)';
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -955 AND SQLCODE != -1408 THEN RAISE; END IF;
    END;
END;
