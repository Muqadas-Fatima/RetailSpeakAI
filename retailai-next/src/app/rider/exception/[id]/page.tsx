import OpsUI from "../../../_components/ops-ui";
export default async function RiderExceptionPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OpsUI role="rider" section="exception-detail" id={id} />; }
