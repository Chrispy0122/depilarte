const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000'; // Make sure this is running
const api = axios.create({ baseURL: API_BASE_URL });

async function getContactByName() {
    try {
        console.log("Fetching contacts...");
        const res = await api.get('/api/pacientes/buscar?telefono=58'); // Try to fetch a contact to get idea of responses
        console.dir(res.data, {depth: null});
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}

getContactByName();
