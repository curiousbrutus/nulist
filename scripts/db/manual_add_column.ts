import oracledb from 'oracledb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONN_STRING,
    });

    console.log("Connected to Oracle Database");

    try {
        await connection.execute(`ALTER TABLE task_assignees ADD zimbra_task_id VARCHAR2(255)`);
        console.log("Column 'zimbra_task_id' added successfully.");
    } catch (err: any) {
        if (err.message.includes("ORA-01430")) { // ORA-01430: column being added already exists in table
            console.log("Column 'zimbra_task_id' already exists.");
        } else {
            console.error("Error adding column:", err);
        }
    }
    
    // Also remove the UNIQUE constraint on task_assignees if needed, or add one for zimbra_task_id if needed. 
    // We might want to query by zimbra_task_id.
    try {
        await connection.execute(`CREATE INDEX idx_assignees_zimbra_id ON task_assignees(zimbra_task_id)`);
        console.log("Index on 'zimbra_task_id' created.");
    } catch (err: any) {
         if (err.message.includes("ORA-00955")) { // Name is already used
            console.log("Index already exists.");
         } else {
             console.error("Error creating index:", err);
         }
    }

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

run();
