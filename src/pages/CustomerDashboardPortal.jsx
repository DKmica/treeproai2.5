import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TreePine, Loader2, AlertCircle, LogOut, Briefcase, FileText,
  Camera, Phone, Mail, CheckCircle2, Clock, ChevronRight,
  RefreshCw, Image, DollarSign, Calendar, MapPin
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SESSION_KEY = "treepro_portal_session";

const JOB_STATUS_LABELS = {
  unscheduled: { label: "Pending Schedule", color: "bg-slate-100 text-slate-700" },
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  dispatched: { label: "Crew Dispatched", color: "bg-indigo-100 text-indigo-700" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  paused: { label: "Paused", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  needs_follow_up: { label: "Follow-up Needed", color: "bg-yellow-100 text-yellow-700" },
  invoiced: { label: "Invoiced", color: "bg-purple-100 text-purple-700" },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

const INVOICE_STATUS_LABELS = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700" },
  viewed: { label: "Viewed", color: "bg-indigo-100 text-indigo-700" },
  partially_paid: { label: "Partially Paid", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Paid", color: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700" },
  void: { label: "Void", color: "bg-slate-100 text-slate-500" },
};

// ─── Login Screen ──────────────────────────────────────────────────────────────
function PortalLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !pin.trim()) { setError("Please enter your email and PIN."); return; }
    setLoading(true);
    try {
      // Find active portal session matching email + PIN
      const sessions = await base44.entities.CustomerPortalSession.filter({
        portal_type: "customer_dashboard",
        portal_email: email.trim().toLowerCase(),
        status: "active",
      });

      const now = new Date();
      const valid = sessions.find(s =>
        s.portal_pin === pin.trim() &&
        (!s.portal_pin_expires_at || new Date(s.portal_pin_expires_at) > now)
      );

      if (!valid) {
        setError("Invalid email or PIN, or your access has expired. Please contact us for a new access code.");
        setLoading(false);
        return;
      }

      // Update last login
      await base44.entities.CustomerPortalSession.update(valid.id, {
        last_login_at: now.toISOString(),
      });

      // Store session in localStorage
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId: valid.id,
        customerId: valid.customer_id,
        email: email.trim().toLowerCase(),
        expiresAt: valid.portal_pin_expires_at,
      }));

      onLogin({ customerId: valid.customer_id, sessionId: valid.id });
    } catch (e) {
      setError("Unable to connect. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
            <TreePine className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Customer Portal</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and the access PIN we sent you.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Access PIN</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit PIN"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Verifying…" : "Access My Account"}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Don't have a PIN? Contact your service provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onViewPhotos, photoCount }) {
  const statusConfig = JOB_STATUS_LABELS[job.status] || { label: job.status, color: "bg-slate-100 text-slate-700" };
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">{job.description || "Tree Service Job"}</p>
            {job.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {job.address}
              </p>
            )}
          </div>
          <Badge className={`${statusConfig.color} text-xs shrink-0`}>{statusConfig.label}</Badge>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {job.scheduled_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(job.scheduled_date), "MMM d, yyyy")}
            </span>
          )}
          {job.total_cost > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${job.total_cost.toLocaleString()}
            </span>
          )}
          {job.crew_name && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {job.crew_name}
            </span>
          )}
        </div>

        {photoCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => onViewPhotos(job)}
          >
            <Camera className="w-3.5 h-3.5" />
            View {photoCount} Site Photo{photoCount !== 1 ? "s" : ""}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({ invoice }) {
  const statusConfig = INVOICE_STATUS_LABELS[invoice.status] || { label: invoice.status, color: "bg-slate-100 text-slate-700" };
  const balanceDue = invoice.balance_due ?? (invoice.total - (invoice.amount_paid || 0));
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">
              Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : ""}
            </p>
            {invoice.due_date && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <Badge className={`${statusConfig.color} text-xs`}>{statusConfig.label}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-semibold">${(invoice.total || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-sm font-semibold text-green-600">${(invoice.amount_paid || 0).toLocaleString()}</p>
          </div>
          <div className={`rounded-lg p-2 ${balanceDue > 0 ? "bg-red-50" : "bg-green-50"}`}>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`text-sm font-semibold ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
              ${Math.max(0, balanceDue).toLocaleString()}
            </p>
          </div>
        </div>

        {invoice.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2">{invoice.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Photo Gallery Modal ───────────────────────────────────────────────────────
function PhotoGallery({ job, photos, onClose }) {
  const [selected, setSelected] = useState(null);
  const TYPE_LABELS = { before: "Before", during: "During", after: "After", damage: "Damage", hazard: "Hazard", equipment: "Equipment" };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <div>
          <p className="text-white font-semibold text-sm">{job.description || "Site Photos"}</p>
          <p className="text-white/60 text-xs">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" onClick={onClose}>
          Close
        </Button>
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <img src={selected.photo_url} alt={selected.caption || "Site photo"} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
          <div className="text-center">
            {selected.type && <Badge className="text-xs mb-1">{TYPE_LABELS[selected.type] || selected.type}</Badge>}
            {selected.caption && <p className="text-white/80 text-sm">{selected.caption}</p>}
          </div>
          <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/20 hover:text-white" onClick={() => setSelected(null)}>
            Back to Gallery
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
            {photos.map((photo) => (
              <button
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                onClick={() => setSelected(photo)}
              >
                <img src={photo.photo_url} alt={photo.caption || "Site photo"} className="w-full h-full object-cover" />
                {photo.type && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5">
                    <p className="text-white text-xs">{TYPE_LABELS[photo.type] || photo.type}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
function CustomerDashboard({ customerId, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingPhotosJob, setViewingPhotosJob] = useState(null);

  useEffect(() => {
    loadData();
  }, [customerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custArr, compArr, jobArr, invArr] = await Promise.all([
        base44.entities.Customer.filter({ id: customerId }),
        base44.entities.CompanySettings.list(),
        base44.entities.Job.filter({ customer_id: customerId }),
        base44.entities.Invoice.filter({ customer_id: customerId }),
      ]);

      const cust = custArr[0] || null;
      setCustomer(cust);
      setCompany(compArr[0] || null);

      const sortedJobs = jobArr.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setJobs(sortedJobs);

      const sortedInvoices = invArr.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setInvoices(sortedInvoices);

      // Load photos for all jobs
      if (jobArr.length > 0) {
        const photoPromises = jobArr.map(j => base44.entities.JobPhoto.filter({ job_id: j.id }));
        const photoArrays = await Promise.all(photoPromises);
        setPhotos(photoArrays.flat());
      }
    } catch (e) {
      toast.error("Failed to load your data. Please refresh.");
    }
    setLoading(false);
  };

  const photosForJob = (jobId) => photos.filter(p => p.job_id === jobId);

  const companyName = company?.company_name || "Your Tree Service";
  const companyPhone = company?.phone || "";

  const activeJobs = jobs.filter(j => !["completed", "paid", "invoiced", "cancelled"].includes(j.status));
  const pastJobs = jobs.filter(j => ["completed", "paid", "invoiced", "cancelled"].includes(j.status));

  const totalOwed = invoices
    .filter(i => !["paid", "void"].includes(i.status))
    .reduce((s, i) => s + Math.max(0, i.balance_due ?? (i.total - (i.amount_paid || 0))), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {company?.logo_url
              ? <img src={company.logo_url} alt="Logo" className="h-9 object-contain" />
              : <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <TreePine className="w-4 h-4 text-primary-foreground" />
                </div>
            }
            <div>
              <p className="font-bold text-sm leading-tight">{companyName}</p>
              <p className="text-xs text-muted-foreground">
                {customer ? `${customer.first_name} ${customer.last_name}` : "My Account"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadData} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <CardContent className="pt-3 pb-3">
                  <p className="text-2xl font-bold text-primary">{activeJobs.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Active Jobs</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-3 pb-3">
                  <p className="text-2xl font-bold">{invoices.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Invoices</p>
                </CardContent>
              </Card>
              <Card className={`text-center ${totalOwed > 0 ? "border-amber-200" : ""}`}>
                <CardContent className="pt-3 pb-3">
                  <p className={`text-2xl font-bold ${totalOwed > 0 ? "text-amber-600" : "text-green-600"}`}>
                    ${totalOwed.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Balance Due</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="jobs">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm">
                  <Briefcase className="w-3.5 h-3.5" />
                  Jobs {jobs.length > 0 && `(${jobs.length})`}
                </TabsTrigger>
                <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-3.5 h-3.5" />
                  Invoices {invoices.length > 0 && `(${invoices.length})`}
                </TabsTrigger>
                <TabsTrigger value="photos" className="gap-1.5 text-xs sm:text-sm">
                  <Camera className="w-3.5 h-3.5" />
                  Photos {photos.length > 0 && `(${photos.length})`}
                </TabsTrigger>
              </TabsList>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="space-y-4 mt-4">
                {jobs.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No jobs found for your account.</p>
                  </Card>
                ) : (
                  <>
                    {activeJobs.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h3>
                        {activeJobs.map(job => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onViewPhotos={setViewingPhotosJob}
                            photoCount={photosForJob(job.id).length}
                          />
                        ))}
                      </div>
                    )}
                    {pastJobs.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Jobs</h3>
                        {pastJobs.map(job => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onViewPhotos={setViewingPhotosJob}
                            photoCount={photosForJob(job.id).length}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="space-y-3 mt-4">
                {invoices.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No invoices yet.</p>
                  </Card>
                ) : (
                  invoices.map(inv => <InvoiceCard key={inv.id} invoice={inv} />)
                )}
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="mt-4">
                {photos.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No site photos uploaded yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Photos from crew visits will appear here.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {jobs.filter(j => photosForJob(j.id).length > 0).map(job => (
                      <div key={job.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">{job.description || "Tree Service"}</p>
                            {job.scheduled_date && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(job.scheduled_date), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => setViewingPhotosJob(job)}
                          >
                            <Image className="w-3 h-3" />
                            View All
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {photosForJob(job.id).slice(0, 4).map((photo, i) => (
                            <button
                              key={photo.id}
                              className="relative aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                              onClick={() => setViewingPhotosJob(job)}
                            >
                              <img src={photo.photo_url} alt="Site photo" className="w-full h-full object-cover" />
                              {i === 3 && photosForJob(job.id).length > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">+{photosForJob(job.id).length - 4}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Contact footer */}
            {companyPhone && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Questions about your service?</p>
                  <Button asChild size="sm" variant="outline" className="gap-2 shrink-0">
                    <a href={`tel:${companyPhone}`}><Phone className="w-3.5 h-3.5" /> Call Us</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Photo gallery overlay */}
      {viewingPhotosJob && (
        <PhotoGallery
          job={viewingPhotosJob}
          photos={photosForJob(viewingPhotosJob.id)}
          onClose={() => setViewingPhotosJob(null)}
        />
      )}
    </div>
  );
}

// ─── Root: handle session persistence ─────────────────────────────────────────
export default function CustomerDashboardPortal() {
  const [portalSession, setPortalSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const handleLogin = (sessionData) => setPortalSession(sessionData);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setPortalSession(null);
  };

  if (!portalSession) return <PortalLogin onLogin={handleLogin} />;
  return <CustomerDashboard customerId={portalSession.customerId} onLogout={handleLogout} />;
}