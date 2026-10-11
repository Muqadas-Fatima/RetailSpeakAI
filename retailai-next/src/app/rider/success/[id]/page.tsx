import OpsUI from "../../../_components/ops-ui";
export default async function RiderSuccessPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OpsUI role="rider" section="success" id={id} />; }
