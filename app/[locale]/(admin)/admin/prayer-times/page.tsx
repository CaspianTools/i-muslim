import { PageHeader } from "@/components/admin/PageHeader";
import { AdminPrayerTimesView } from "@/components/admin/AdminPrayerTimesView";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Prayer Times"
        subtitle="Calculation method, juristic school, and 30-day schedule for the resolved location."
      />
      <AdminPrayerTimesView />
    </div>
  );
}
