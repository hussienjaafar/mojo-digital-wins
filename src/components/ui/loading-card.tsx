export const LoadingCard = () => {
  return (
    <div className="portal-card p-6 space-y-3 portal-animate-fade-in">
      <div className="portal-skeleton h-6 w-1/3" />
      <div className="portal-skeleton h-4 w-full" />
      <div className="portal-skeleton h-4 w-2/3" />
    </div>
  );
};
