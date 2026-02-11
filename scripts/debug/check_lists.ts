
import { getConnection, executeQuery, closePool, executeNonQuery } from '../../src/lib/oracle';
import { v4 as uuidv4 } from 'uuid';

const USER_EMAIL = 'metehanceylan@optimed.com.tr';

async function checkUserLists() {
    try {
        console.log('✅ Oracle Connection Pool başarıyla oluşturuldu');

        // 1. Get User ID
        console.log(`Finding user: ${USER_EMAIL}...`);
        // executeQuery returns T[] (array of rows/objects directly)
        const userRows = await executeQuery<{ ID: string }>(
            `SELECT id FROM profiles WHERE email = :email`,
            { email: USER_EMAIL }
        );

        if (!userRows || userRows.length === 0) {
            console.error('❌ User not found!');
            return;
        }

        // Access property directly on the row object (cleanOracleObject makes keys lowercase)
        const userId = (userRows[0] as any).id;
        console.log(`User found: ${userId}`);
        
        console.log(`Checking folders for user: ${userId}...`);
        const folderRows = await executeQuery(
             `SELECT id, title FROM folders WHERE user_id = :uid`,
             { uid: userId }
        );
        
        if (folderRows.length > 0) {
             const folderId = (folderRows[0] as any).id;
             console.log(`User has folders. Checking lists in folder ${folderId}...`);
             
             const listRows = await executeQuery(
                `SELECT id, title FROM lists WHERE folder_id = :fid`,
                { fid: folderId }
             );
             
             if (listRows.length > 0) {
                 console.log('User has the following lists:');
                 listRows.forEach((row: any) => {
                     console.log(`ID: ${row.id}, Title: ${row.title}`);
                 });
             } else {
                 console.log('Folder has no lists.');
             }
        } else {
             console.log('User has no folders.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await closePool();
        console.log('✅ Oracle Pool kapatıldı');
    }
}

checkUserLists();
