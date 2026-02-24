const url = 'http://192.168.1.208:8088/';
const username = 'tlongest';
const password = 'RCLONErac3car$';

async function testWebDav() {
    try {
        const authBase64 = Buffer.from(`${username}:${password}`).toString('base64');
        console.log("Auth header:", 'Basic ' + authBase64);

        const res = await fetch(url + 'librelift_backup.json', {
            method: 'PROPFIND', // Or GET if we just want to see auth failure
            headers: {
                'Authorization': 'Basic ' + authBase64,
                'Depth': '0'
            }
        });

        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Response:", text.substring(0, 200));

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testWebDav();
