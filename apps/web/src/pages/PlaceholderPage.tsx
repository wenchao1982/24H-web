export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page">
      <h2>{title}</h2>
      <p className="empty">该模块将在后续里程碑实现。</p>
    </div>
  );
}
