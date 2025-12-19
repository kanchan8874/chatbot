export default function ChatLayout({ sidebar, children, infoPanel }) {
  return (
    <div className="flex w-full gap-4">
      {sidebar}
      <div className="flex min-w-0 flex-1">
        {children}
      </div>
      {infoPanel}
    </div>
  );
}



