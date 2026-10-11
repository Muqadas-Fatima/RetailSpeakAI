import OpsUI from "../../../_components/ops-ui";
export default async function StaffTaskDetailPage({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; return <OpsUI role="staff" section="task-detail" id={orderId} />; }
