// import { getDashboardData } from "@/actions/admin";

export const metadata = {
  title: "Dashboard | DrivsyAI Admin",
  description: "Admin dashboard for DrivsyAI car marketplace",
};

export default async function AdminDashboardPage() {
  // Fetch dashboard data
  // const dashboardData = await getDashboardData();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
    </div>
  );
}