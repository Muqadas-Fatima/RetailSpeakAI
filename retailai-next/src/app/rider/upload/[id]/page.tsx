import OpsUI from "../../../_components/ops-ui";
export default async function RiderUploadPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OpsUI role="rider" section="upload" id={id} />; }
