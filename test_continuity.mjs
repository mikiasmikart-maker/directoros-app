import http from 'http';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchJson = (method, path, body = undefined) => new Promise((resolve, reject) => {
  const req = http.request({
    hostname: 'localhost',
    port: 8787,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      resolve({
        status: res.statusCode,
        body: data ? JSON.parse(data) : null
      });
    });
  });
  req.on('error', reject);
  if (body) {
    req.write(JSON.stringify(body));
  }
  req.end();
});

async function run() {
  const job_id = "directoros_registry_test_003";
  
  console.log("=== STEP 1 & 2: Submit render ===\\n");
  const submitRes = await fetchJson('POST', '/api/runtime/render', {
    intent: "A beautiful sunset",
    recipe: "refine_then_render_route",
    scene_id: "test_scene",
    engine_target: "comfyui",
    render_payload: { test: true },
    job: job_id
  });
  
  console.log(`POST /api/runtime/render returned HTTP ${submitRes.status}\\n`);
  console.log("Response Body:");
  console.log(JSON.stringify(submitRes.body, null, 2));
  
  console.log("\\n\\n=== STEP 3 & 4: Immediate Queries ===\\n");
  const jobsRes1 = await fetchJson('GET', '/api/runtime/jobs');
  const jobRes1 = await fetchJson('GET', `/api/runtime/jobs/${job_id}`);
  
  console.log("Immediate /api/runtime/jobs length: " + (jobsRes1.body?.jobs?.length || 0));
  const foundInList1 = jobsRes1.body?.jobs?.find(j => j.job_id === job_id);
  console.log("Job found in immediate /api/runtime/jobs? " + (foundInList1 ? "YES" : "NO"));
  if (foundInList1) {
    console.log(JSON.stringify(foundInList1, null, 2));
  }
  
  console.log(`\\nImmediate /api/runtime/jobs/${job_id} returned HTTP ${jobRes1.status}`);
  console.log(JSON.stringify(jobRes1.body, null, 2));
  
  console.log("\\n\\n=== STEP 5: Waiting 2000ms ===\\n");
  await delay(2000);
  
  const jobsRes2 = await fetchJson('GET', '/api/runtime/jobs');
  const jobRes2 = await fetchJson('GET', `/api/runtime/jobs/${job_id}`);
  
  console.log("Delayed /api/runtime/jobs length: " + (jobsRes2.body?.jobs?.length || 0));
  const foundInList2 = jobsRes2.body?.jobs?.find(j => j.job_id === job_id);
  console.log("Job found in delayed /api/runtime/jobs? " + (foundInList2 ? "YES" : "NO"));
  if (foundInList2) {
    console.log(JSON.stringify(foundInList2, null, 2));
  }
  
  console.log(`\\nDelayed /api/runtime/jobs/${job_id} returned HTTP ${jobRes2.status}`);
  console.log(JSON.stringify(jobRes2.body, null, 2));
}

run().catch(err => {
  console.error("Error during validation run:", err);
});
