import { t } from "../i18n";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page">
      <h2>{title}</h2>
      <p className="empty">{t("page.placeholder")}</p>
    </div>
  );
}
