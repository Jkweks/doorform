// 👇 Add this line at the very top
const API_BASE = "http://192.168.4.251:3000"; // change IP to your server's IP

let latestJobId = null;

document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(e.target).entries());

  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  const data = await res.json();
  latestJobId = data.id;
  alert('Job saved with ID ' + latestJobId);
});

document.getElementById('uploadFrames').addEventListener('click', async () => {
  if (!latestJobId) return alert('Save a job first!');
  const fileInput = document.getElementById('framesCsv');
  if (!fileInput.files.length) return alert('Select a CSV first.');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  await fetch(`${API_BASE}/api/frames/import/${latestJobId}`, { method: 'POST', body: formData });
  alert('Frames imported.');
});

document.getElementById('uploadDoors').addEventListener('click', async () => {
  if (!latestJobId) return alert('Save a job first!');
  const fileInput = document.getElementById('doorsCsv');
  if (!fileInput.files.length) return alert('Select a CSV first.');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  await fetch(`${API_BASE}/api/doors/import/${latestJobId}`, { method: 'POST', body: formData });
  alert('Doors imported.');
});

document.getElementById('generatePdf').addEventListener('click', async () => {
  if (!latestJobId) return alert('Save a job first!');

  const jobRes = await fetch(`${API_BASE}/api/jobs/latest`);
  const job = await jobRes.json();

  const framesRes = await fetch(`${API_BASE}/api/frames/job/${latestJobId}`);
  const frames = await framesRes.json();

  const doorsRes = await fetch(`${API_BASE}/api/doors/job/${latestJobId}`);
  const doors = await doorsRes.json();

  generatePdf(job, frames, doors);
});
