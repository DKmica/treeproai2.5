import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Sparkles, AlertTriangle, TreePine, Upload } from "lucide-react";

const PHOTO_CATEGORIES = [
  { key: "full_tree", label: "Full Tree", required: true, hint: "Step back and capture the whole tree" },
  { key: "trunk_base", label: "Trunk / Base", required: true, hint: "Close-up of the trunk at ground level" },
  { key: "canopy", label: "Canopy", required: true, hint: "Looking up into the canopy" },
  { key: "drop_zone", label: "Drop Zone", required: true, hint: "Where wood/debris will fall" },
  { key: "access_path", label: "Access Path", required: false, hint: "How equipment will get in/out" },
  { key: "nearby_structure", label: "Nearby House/Fence", required: false, hint: "Any structures within fall range" },
  { key: "power_lines", label: "Power Lines / Utilities", required: false, hint: "Any utility hazards nearby" },
  { key: "stump_area", label: "Stump Area", required: false, hint: "If stump grinding is needed" },
  { key: "storm_damage", label: "Storm Damage", required: false, hint: "If emergency/storm work" },
];

const STEPS = [
  "Confirm Property",
  "Capture Photos",
  "Tree Measurements",
  "Hazards & Access",
  "Equipment Needed",
  "AI Analysis",
];

const EQUIPMENT_OPTIONS = ["Chainsaw only", "Climbing gear", "Bucket truck", "Crane", "Stump grinder", "Chipper", "Skid steer"];

export default function SalesAssessmentWorkflow({ lead, onBack, onComplete, user }) {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState({}); // { category_key: [url, ...] }
  const [uploading, setUploading] = useState({});
  const [measurements, setMeasurements] = useState({ height_ft: "", dbh_inches: "", canopy_spread: "" });
  const [hazards, setHazards] = useState({ structures_nearby: false, power_lines: false, limited_drop_zone: false, canopy_over_structure: false });
  const [access, setAccess] = useState("moderate");
  const [equipment, setEquipment] = useState([]);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileInputRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);

  const handlePhotoUpload = async (e, category) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(p => ({ ...p, [category]: true }));
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setPhotos(p => ({ ...p, [category]: [...(p[category] || []), ...urls] }));
    setUploading(p => ({ ...p, [category]: false }));
    toast.success(`${files.length} photo(s) uploaded`);
  };

  const allRequiredPhotos = PHOTO_CATEGORIES.filter(c => c.required).every(c => (photos[c.key] || []).length > 0);
  const allImageUrls = Object.values(photos).flat();

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    const heightNum = parseFloat(measurements.height_ft) || null;
    const dbhNum = parseFloat(measurements.dbh_inches) || null;

    const prompt = `You are a certified arborist and tree removal pricing expert.
Analyze this field assessment for a tree service job:

Customer: ${lead.first_name} ${lead.last_name}, ${lead.address || ""}
Request: ${lead.description || "Tree service"}
Salesperson Notes: ${notes || "None"}

Tree Measurements:
- Estimated height: ${heightNum || "unknown"} ft
- Trunk diameter (DBH): ${dbhNum || "unknown"} inches
- Canopy spread: ${measurements.canopy_spread || "unknown"} ft

Site Conditions:
- Structures nearby: ${hazards.structures_nearby}
- Canopy over structure: ${hazards.canopy_over_structure}
- Limited drop zone: ${hazards.limited_drop_zone}
- Power lines nearby: ${hazards.power_lines}
- Access difficulty: ${access}
- Equipment needed: ${equipment.join(", ") || "TBD"}

Photos uploaded: ${allImageUrls.length} photos across ${Object.keys(photos).length} categories.

Based on $500/hour crew rate, provide a realistic pricing estimate. Consider:
- Minimum for any job: $350
- Small trees (<25ft): $500-1200
- Medium trees (25-50ft): $1200-3500
- Large trees (50-70ft): $3500-6500
- Very large trees (70ft+): $6500-12000+
- Add crane if needed (>60ft or tight access): +$1500-3000
- Structures nearby or limited drop zone: +20-30% markup
- Stump grinding: +$150-400

Provide a confidence score and list what info is missing.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: allImageUrls.slice(0, 5),
      response_json_schema: {
        type: "object",
        properties: {
          detected_species: { type: "string" },
          estimated_height_ft_low: { type: "number" },
          estimated_height_ft_high: { type: "number" },
          estimated_dbh_inches_low: { type: "number" },
          estimated_dbh_inches_high: { type: "number" },
          canopy_spread_ft: { type: "number" },
          risk_level: { type: "string", enum: ["low","moderate","high","extreme"] },
          condition_summary: { type: "string" },
          hazards_detected: { type: "string" },
          access_difficulty: { type: "string", enum: ["easy","moderate","difficult","very_difficult"] },
          crane_likely: { type: "boolean" },
          crane_required: { type: "boolean" },
          stump_grinding_likely: { type: "boolean" },
          structures_nearby: { type: "boolean" },
          canopy_over_structure: { type: "boolean" },
          limited_drop_zone: { type: "boolean" },
          recommended_service: { type: "string" },
          price_low: { type: "number" },
          price_high: { type: "number" },
          confidence_score: { type: "number" },
          missing_info_questions: { type: "string" },
          ai_reasoning_summary: { type: "string" },
          urgency_level: { type: "string", enum: ["low","normal","high","emergency"] },
          cleanup_volume_estimate: { type: "string" },
        }
      }
    });

    // Save AIAnalysisRecord
    const record = await base44.entities.AIAnalysisRecord.create({
      lead_id: lead.id,
      image_urls: allImageUrls,
      original_customer_notes: lead.description || "",
      detected_species: result.detected_species,
      estimated_height_ft_low: result.estimated_height_ft_low || (heightNum ? heightNum * 0.9 : null),
      estimated_height_ft_high: result.estimated_height_ft_high || (heightNum ? heightNum * 1.1 : null),
      estimated_dbh_inches_low: result.estimated_dbh_inches_low || (dbhNum ? dbhNum * 0.9 : null),
      estimated_dbh_inches_high: result.estimated_dbh_inches_high || (dbhNum ? dbhNum * 1.1 : null),
      canopy_spread_ft: result.canopy_spread_ft,
      condition_summary: result.condition_summary,
      hazards_detected: result.hazards_detected,
      access_difficulty: result.access_difficulty || access,
      risk_level: result.risk_level,
      urgency_level: result.urgency_level,
      crane_likely: result.crane_likely || false,
      crane_required: result.crane_required || false,
      stump_grinding_likely: result.stump_grinding_likely || false,
      structures_nearby: hazards.structures_nearby || result.structures_nearby || false,
      canopy_over_structure: hazards.canopy_over_structure || result.canopy_over_structure || false,
      limited_drop_zone: hazards.limited_drop_zone || result.limited_drop_zone || false,
      recommended_service: result.recommended_service,
      price_low: result.price_low,
      price_high: result.price_high,
      confidence_score: result.confidence_score,
      missing_info_questions: result.missing_info_questions,
      ai_reasoning_summary: result.ai_reasoning_summary,
      cleanup_volume_estimate: result.cleanup_volume_estimate,
      human_review_status: "pending",
    });

    await base44.entities.Lead.update(lead.id, {
      ai_analysis_id: record.id,
      ai_score: result.confidence_score,
      estimated_value: result.price_high,
    }).catch(() => {});

    await base44.entities.ActivityLog.create({
      related_type: "Lead", related_id: lead.id,
      actor: user?.full_name || "salesperson",
      action: "Field AI assessment completed",
      notes: `${allImageUrls.length} photos · Est: $${result.price_low?.toLocaleString()}–$${result.price_high?.toLocaleString()}`,
    }).catch(() => {});

    setAiResult({ ...result, id: record.id });
    setAnalyzing(false);
    toast.success("AI analysis complete!");
  };

  const toggleEquipment = (item) => {
    setEquipment(prev => prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]);
  };

  const toggleHazard = (key) => setHazards(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-bold">On-Site Assessment</h2>
          <p className="text-xs text-muted-foreground">{lead.first_name} {lead.last_name}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">

        {/* STEP 0: Confirm Property */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="font-semibold text-base">{lead.first_name} {lead.last_name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{lead.address || "No address on file"}</p>
              {lead.description && <p className="text-sm mt-2">{lead.description}</p>}
            </div>
            <div className="space-y-2 text-sm">
              {lead.urgency === "emergency" && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">Emergency / Storm Damage</span>
                </div>
              )}
            </div>
            <Textarea
              placeholder="Add on-site notes, observations, parking notes, gate code, dog warning..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="text-base"
            />
          </div>
        )}

        {/* STEP 1: Photos */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tap a category to upload photos. Required categories are marked.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={e => handlePhotoUpload(e, activeCategory)}
            />
            <div className="space-y-2">
              {PHOTO_CATEGORIES.map(cat => {
                const catPhotos = photos[cat.key] || [];
                return (
                  <div
                    key={cat.key}
                    className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${catPhotos.length > 0 ? "border-primary/40 bg-primary/5" : "border-dashed border-border"}`}
                    onClick={() => { setActiveCategory(cat.key); fileInputRef.current?.click(); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {catPhotos.length > 0
                          ? <CheckCircle2 className="w-4 h-4 text-primary" />
                          : <Camera className="w-4 h-4 text-muted-foreground" />
                        }
                        <div>
                          <p className="text-sm font-medium">{cat.label}</p>
                          <p className="text-xs text-muted-foreground">{cat.hint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cat.required && <Badge className="text-xs bg-orange-100 text-orange-700">Required</Badge>}
                        {uploading[cat.key] && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        {catPhotos.length > 0 && <span className="text-xs text-primary font-bold">{catPhotos.length} ✓</span>}
                      </div>
                    </div>
                    {catPhotos.length > 0 && (
                      <div className="flex gap-1.5 mt-2 overflow-x-auto">
                        {catPhotos.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!allRequiredPhotos && (
              <p className="text-xs text-orange-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Required photos missing — you can continue but AI confidence will be lower</p>
            )}
          </div>
        )}

        {/* STEP 2: Measurements */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimated Tree Height (ft)</label>
              <Input
                type="number"
                placeholder="e.g. 45"
                value={measurements.height_ft}
                onChange={e => setMeasurements(p => ({ ...p, height_ft: e.target.value }))}
                className="text-lg h-12"
              />
              <p className="text-xs text-muted-foreground">Tip: compare to nearby house (avg 10ft/story)</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Trunk Diameter / DBH (inches)</label>
              <Input
                type="number"
                placeholder="e.g. 18"
                value={measurements.dbh_inches}
                onChange={e => setMeasurements(p => ({ ...p, dbh_inches: e.target.value }))}
                className="text-lg h-12"
              />
              <p className="text-xs text-muted-foreground">Measure ~4.5ft above ground. Fist = ~4 inches.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Canopy Spread (ft)</label>
              <Input
                type="number"
                placeholder="e.g. 30"
                value={measurements.canopy_spread}
                onChange={e => setMeasurements(p => ({ ...p, canopy_spread: e.target.value }))}
                className="text-lg h-12"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Hazards & Access */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Hazards Present</p>
              <div className="space-y-2">
                {[
                  { key: "structures_nearby", label: "Structures Nearby (house, fence, shed)" },
                  { key: "canopy_over_structure", label: "Canopy Overhangs a Structure" },
                  { key: "limited_drop_zone", label: "Limited Drop Zone / Tight Space" },
                  { key: "power_lines", label: "Power Lines / Utilities Nearby" },
                ].map(h => (
                  <button
                    key={h.key}
                    onClick={() => toggleHazard(h.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${hazards[h.key] ? "border-orange-400 bg-orange-50" : "border-border"}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${hazards[h.key] ? "bg-orange-500 text-white" : "border-2 border-border"}`}>
                      {hazards[h.key] && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className="text-sm">{h.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Access Difficulty</p>
              <div className="grid grid-cols-2 gap-2">
                {["easy","moderate","difficult","very_difficult"].map(a => (
                  <button
                    key={a}
                    onClick={() => setAccess(a)}
                    className={`p-3 rounded-xl border-2 text-sm capitalize transition-all ${access === a ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
                  >
                    {a.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Equipment */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select all equipment likely needed</p>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_OPTIONS.map(item => (
                <button
                  key={item}
                  onClick={() => toggleEquipment(item)}
                  className={`p-3 rounded-xl border-2 text-sm text-left transition-all ${equipment.includes(item) ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
                >
                  {equipment.includes(item) && "✓ "}{item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: AI Analysis */}
        {step === 5 && (
          <div className="space-y-4">
            {!aiResult && !analyzing && (
              <div className="text-center py-6 space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Ready for AI Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  {allImageUrls.length} photos · {Object.values(measurements).filter(Boolean).length}/3 measurements · {equipment.length} equipment selected
                </p>
                <Button onClick={runAIAnalysis} className="h-12 px-8 text-base gap-2">
                  <Sparkles className="w-5 h-5" /> Analyze Now
                </Button>
              </div>
            )}

            {analyzing && (
              <div className="text-center py-10 space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                <p className="font-medium">AI is analyzing your assessment...</p>
                <p className="text-sm text-muted-foreground">This takes about 15–20 seconds</p>
              </div>
            )}

            {aiResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Analysis Complete</p>
                    <p className="text-xs text-green-600">Confidence: {aiResult.confidence_score}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {aiResult.detected_species && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Species</p>
                      <p className="font-semibold">{aiResult.detected_species}</p>
                    </div>
                  )}
                  {aiResult.risk_level && (
                    <div className={`rounded-lg p-3 ${aiResult.risk_level === "extreme" ? "bg-red-50" : aiResult.risk_level === "high" ? "bg-orange-50" : "bg-yellow-50"}`}>
                      <p className="text-xs text-muted-foreground">Risk Level</p>
                      <p className={`font-semibold capitalize ${aiResult.risk_level === "extreme" ? "text-red-700" : aiResult.risk_level === "high" ? "text-orange-700" : "text-yellow-700"}`}>{aiResult.risk_level}</p>
                    </div>
                  )}
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">AI Estimated Price Range</p>
                  <p className="text-2xl font-bold text-primary">${aiResult.price_low?.toLocaleString()} – ${aiResult.price_high?.toLocaleString()}</p>
                </div>
                {aiResult.ai_reasoning_summary && (
                  <div className="bg-muted/30 rounded-xl p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">AI Notes</p>
                    {aiResult.ai_reasoning_summary}
                  </div>
                )}
                {aiResult.missing_info_questions && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
                    <p className="font-medium text-yellow-800 flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-4 h-4" /> Improve Confidence By:
                    </p>
                    <p className="text-yellow-700">{aiResult.missing_info_questions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="p-4 border-t bg-background flex gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(s => s - 1)}>Back</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1 h-12" onClick={() => setStep(s => s + 1)}>
            Continue →
          </Button>
        ) : (
          <Button
            className="flex-1 h-12 gap-2"
            disabled={!aiResult}
            onClick={onComplete}
          >
            <CheckCircle2 className="w-5 h-5" /> Build Quote
          </Button>
        )}
      </div>
    </div>
  );
}