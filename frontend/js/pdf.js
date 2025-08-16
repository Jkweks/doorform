// Utility to render a simple job report PDF using jsPDF. Accepts job
// metadata along with arrays of frame and door details.
function generatePdf(job, frames, doors) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Page 1: Job info
  doc.setFontSize(16);
  doc.text('Job Information', 10, 10);
  doc.setFontSize(12);
  doc.text(`Job Number: ${job.job_number}`, 10, 20);
  doc.text(`Job Name: ${job.job_name}`, 10, 30);
  doc.text(`Project Manager: ${job.pm}`, 10, 40);
  doc.text(`Work Order #: ${job.work_order}`, 10, 50);

  // Frames pages
  frames.forEach((frame, i) => {
    doc.addPage();
    doc.text(`Frame ${i + 1}`, 10, 10);
    doc.text(`Frame Number: ${frame.frame_number}`, 10, 20);
    doc.text(`Frame Details: ${frame.frame_details}`, 10, 30);
  });

  // Doors pages
  doors.forEach((door, i) => {
    doc.addPage();
    doc.text(`Door ${i + 1}`, 10, 10);
    doc.text(`Door Number: ${door.door_number}`, 10, 20);
    doc.text(`Door Details: ${door.door_details}`, 10, 30);
  });

  doc.save(`Job_${job.job_number}_Report.pdf`);
}
