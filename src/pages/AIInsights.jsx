import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, BarChart2, Target, Lightbulb, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from "recharts";

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const SEVERITY_COLORS = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-blue-600",
  info: "text-muted-foreground",
};

export default function AIInsights() {
  const qc = useQueryClient();
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: accuracyRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["estimate_accuracy"],
    queryFn: () => base44.entities.EstimateAccuracy.list("-recorded_at", 200),
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await base44.functions.invoke("analyzeEstimateAccuracy", {});
      setAnalysisResult(res.data);
      toast.success("AI analysis complete");
    } catch (e) {
      toast.error("Analysis failed: " + (e.message || "Unknown error"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Chart data: accuracy by species
  const speciesData = analysisResult?.raw_stats?.species_breakdown?.map(s => ({
    name: s.species.length > 12 ? s.species.slice(0, 12) + "…" : s.species,
    accuracy: s.avg_accuracy_pct,
    count: s.count,
  })) || [];

  // Chart data: accuracy by complexity tier
  const complexityData = analysisResult?.raw_stats?.complexity_breakdown?.map(c => ({
    name: c.tier,
    accuracy: c.avg_accuracy_pct,
    count: c.count,
  })) || [];

  // Summary cards from local records (always available)
  const withAccuracy = accuracyRecords.filter(r => r.accuracy_pct !== null && r.accuracy_pct !== undefined);
  const avgAccuracy = withAccuracy.length > 0
    ? Math.round(withAccuracy.reduce((s, r) => s + r.accuracy_pct, 0) / withAccuracy.length)
    : null;
  const underCount = accuracyRecords.filter(r => r.accuracy_pct < -10).length;
  const overCount = accuracyRecords.filter(r => r.accuracy_pct > 15).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> AI Estimating Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feedback loop — compares quoted vs. actual costs to continuously improve estimates.
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={isAnalyzing || accuracyRecords.length === 0} className="gap-2">
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isAnalyzing ? "Analyzing…" : "Run AI Analysis"}
        </Button>
      </div>

      {/* Summary Stats — always live from DB */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Data Points</p>
            <p className="text-2xl font-bold mt-1">{accuracyRecords.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed jobs tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg Accuracy</p>
            <p className={`text-2xl font-bold mt-1 ${avgAccuracy === null ? "text-muted-foreground" : avgAccuracy >= -5 && avgAccuracy <= 20 ? "text-green-600" : "text-yellow-600"}`}>
              {avgAccuracy === null ? "—" : `${avgAccuracy > 0 ? "+" : ""}${avgAccuracy}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Quoted vs actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Under-estimated</p>
            <p className={`text-2xl font-bold mt-1 ${underCount > 0 ? "text-red-600" : "text-green-600"}`}>{underCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Jobs &gt;10% below actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Over-estimated</p>
            <p className={`text-2xl font-bold mt-1 ${overCount > 2 ? "text-yellow-600" : "text-green-600"}`}>{overCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Jobs &gt;15% above actual</p>
          </CardContent>
        </Card>
      </div>

      {accuracyRecords.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="font-semibold text-muted-foreground">No feedback data yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              As jobs are completed and invoiced, this page will automatically track how accurate your AI estimates were and suggest improvements.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Results */}
      {analysisResult && (
        <>
          {/* Overview */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> AI Assessment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{analysisResult.overall_accuracy_assessment || analysisResult.summary}</p>
            </CardContent>
          </Card>

          {/* Charts */}
          {(speciesData.length > 0 || complexityData.length > 0) && (
            <div className="grid lg:grid-cols-2 gap-6">
              {speciesData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" /> Accuracy by Species
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">Positive = over-estimated, Negative = under-estimated (margin risk)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={speciesData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v) => [`${v}%`, "Avg Accuracy"]} />
                        <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                        <Bar dataKey="accuracy" name="Accuracy %" radius={[3, 3, 0, 0]}
                          fill="#16a34a"
                          label={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {complexityData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4" /> Accuracy by Complexity Tier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">Positive = over-estimated, Negative = under-estimated (margin risk)</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={complexityData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v) => [`${v}%`, "Avg Accuracy"]} />
                        <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                        <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Insights */}
          {analysisResult.insights?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" /> Key Findings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysisResult.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${insight.severity === "high" ? "bg-red-500" : insight.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{insight.category}</span>
                        {insight.data_points > 0 && (
                          <span className="text-xs text-muted-foreground">({insight.data_points} jobs)</span>
                        )}
                      </div>
                      <p className="text-sm">{insight.finding}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pricing Recommendations */}
          {analysisResult.recommendations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" /> Pricing Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Apply these in Company Settings → Pricing to improve future estimates.</p>
                <div className="space-y-3">
                  {analysisResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{rec.setting}</p>
                          <Badge className={`${PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low} text-xs border`}>
                            {rec.priority} priority
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {rec.current_value && (
                          <p className="text-xs text-muted-foreground line-through">${rec.current_value?.toLocaleString()}</p>
                        )}
                        {rec.recommended_value && (
                          <p className="text-sm font-bold text-primary">${rec.recommended_value?.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {analysisResult.risk_flags?.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-4 h-4" /> Risk Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {analysisResult.risk_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Historical Records Table */}
      {accuracyRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Job Accuracy History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2 pr-4">Customer</th>
                    <th className="text-left py-2 pr-4">Species</th>
                    <th className="text-left py-2 pr-4">Risk</th>
                    <th className="text-right py-2 pr-4">Quoted</th>
                    <th className="text-right py-2 pr-4">Actual</th>
                    <th className="text-right py-2">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyRecords.map(r => {
                    const acc = r.accuracy_pct;
                    const accColor = acc === null ? "text-muted-foreground" :
                      acc < -10 ? "text-red-600 font-semibold" :
                      acc > 20 ? "text-yellow-600" : "text-green-600";
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4">{r.customer_name || "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{r.species || "—"}</td>
                        <td className="py-2 pr-4">
                          {r.risk_level && <Badge variant="outline" className="text-xs capitalize">{r.risk_level}</Badge>}
                        </td>
                        <td className="py-2 pr-4 text-right">{r.quoted_price ? `$${r.quoted_price.toLocaleString()}` : "—"}</td>
                        <td className="py-2 pr-4 text-right">{r.actual_invoiced ? `$${r.actual_invoiced.toLocaleString()}` : "—"}</td>
                        <td className={`py-2 text-right ${accColor}`}>
                          {acc === null ? "—" : `${acc > 0 ? "+" : ""}${acc}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}