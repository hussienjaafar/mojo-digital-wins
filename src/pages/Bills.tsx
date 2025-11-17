import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { BillTracker } from "@/components/bills/BillTracker";

export default function Bills() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      <main className="container mx-auto px-4 py-8 mt-16">
        <BillTracker />
      </main>
      <Footer />
    </div>
  );
}
