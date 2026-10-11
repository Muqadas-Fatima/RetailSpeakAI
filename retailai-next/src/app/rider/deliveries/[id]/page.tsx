import OpsUI from "../../../_components/ops-ui";
export default async function RiderDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OpsUI role="rider" section="delivery-detail" id={id} />; }
