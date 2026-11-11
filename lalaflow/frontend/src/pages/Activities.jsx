import { ActivityCard } from "../components/Cards.jsx";
import { MimiNote } from "../components/Mimi.jsx";
import { PageHero } from "../components/Shell.jsx";
import { useSeo } from "../seo.js";

export default function ActivitiesPage({ content, activities, dataState }) {
  const { company, pages } = content;
  useSeo({
    title: `Hoạt động | ${company.name}`,
    description: pages.activityHeroText || `Tin tức và hoạt động của ${company.name}.`,
    path: "/hoat-dong",
    company,
  });

  return (
    <>
      <PageHero eyebrow={pages.activityEyebrow} title={pages.activityHeroTitle} text={pages.activityHeroText} focus="18% 52%" />
      <section className="wrap section">
        {dataState === "loading" && <p className="muted">Đang mở sổ ghi chép…</p>}
        {dataState === "error" && <MimiNote state="error"><p>Chưa tải được hoạt động, bạn thử tải lại trang nhé.</p></MimiNote>}
        {dataState === "ready" && !activities.length && <MimiNote state="info"><p>Chưa có hoạt động nào được đăng. Mimi sẽ báo bạn khi có tin mới nhé!</p></MimiNote>}
        <div className="activity-board">
          {activities.map((activity) => <ActivityCard key={activity.id} activity={activity} expanded />)}
        </div>
      </section>
    </>
  );
}
