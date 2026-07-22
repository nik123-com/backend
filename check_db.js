const mongoose = require('mongoose');
const dns = require('dns');

try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
    console.log("DNS setServers failed:", e);
}

const dbUri = "mongodb+srv://nikhilxe_db_user:Akhil*082@ecommerce.ble8wa5.mongodb.net/ecommerce";
const dbUriDefault = "mongodb+srv://nikhilxe_db_user:Akhil*082@ecommerce.ble8wa5.mongodb.net/";

async function testConn(uri, name) {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log(`Connected to ${name}`);
    const collections = await conn.db.listCollections().toArray();
    console.log(`Collections in ${name}:`, collections.map(c => c.name));
    
    // Check categories collection count
    try {
      const catCol = conn.db.collection('categories');
      const count = await catCol.countDocuments({});
      console.log(`Categories count in ${name}:`, count);
      if (count > 0) {
        const samples = await catCol.find({}).limit(5).toArray();
        console.log(`Sample categories in ${name}:`, samples);
      }
    } catch (e) {
      console.log(`Error reading categories in ${name}:`, e.message);
    }
    
    await conn.close();
  } catch (err) {
    console.error(`Error connecting to ${name}:`, err.message);
  }
}

async function run() {
  await testConn(dbUriDefault, "Default URI");
  await testConn(dbUri, "URI with /ecommerce");
  process.exit(0);
}

run();
