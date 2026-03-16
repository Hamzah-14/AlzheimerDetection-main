// -----------------------------------------------------------------------------
// lib/cases.ts
// Single source of truth for all case data across the platform.
// Every page (Dashboard, Viewer, Explain, Reports, Timeline) imports from here.
// To add a new case: add one entry in each of the five data records below.
// -----------------------------------------------------------------------------

// -- Shared types --------------------------------------------------------------

export type DatasetClass = "AD" | "MCI" | "NC";
export type Plane = "Axial" | "Coronal" | "Sagittal";
export type TimelineStatus = "Complete" | "Active" | "Pending";
export type RiskLevel = "High" | "Medium" | "Low";

// -- Feature types (each page uses a slightly different shape) -----------------

export type ViewerFeature = {
  name: string;
  value: number;
  color: string;
};

export type ExplainFeature = {
  name: "Contrast" | "Homogeneity" | "Energy" | "Correlation";
  value: number;
  color: string;
  note: string;
  tooltip: string;
};

export type ReportFeature = {
  name: string;
  value: number;
  color: string;
  note: string;
};

// -- Page-specific case types ---------------------------------------------------

export type DashboardCase = {
  id: string;
  region: string;
  risk: RiskLevel;
  lat: string;
  status: string;
  note: string;
  confidence: string;
  feature: string;
  recommendation: string;
};

export type ViewerCase = {
  datasetClass: DatasetClass;
  region: string;
  confidence: number;
  decision: string;
  status: string;
  latency: string;
  summary: string;
  notes: string;
  recommendation: string;
  defaultPlane: Plane;
  defaultSlice: number;
  defaultOverlayOpacity: number;
  features: ViewerFeature[];
};

export type ExplainCase = {
  datasetClass: DatasetClass;
  region: string;
  confidence: number;
  decision: string;
  summary: string;
  action: string;
  saliency: string;
  rationale: string[];
  features: ExplainFeature[];
};

export type ReportCase = {
  datasetClass: DatasetClass;
  region: string;
  confidence: number;
  decision: string;
  status: string;
  latency: string;
  summary: string;
  ai_narrative?: string;
  notes: string;
  recommendation: string;
  explainability: string;
  preprocessing: string;
  volumeShape: string;
  features: ReportFeature[];
};

export type TimelineEvent = {
  title: string;
  time: string;
  status: TimelineStatus;
  description: string;
  icon: "upload" | "preprocess" | "radiomics" | "classify" | "report" | "review";
  plain?: string;
};

export type TimelineCase = {
  datasetClass: DatasetClass;
  region: string;
  confidence: number;
  decision: string;
  status: string;
  latency: string;
  summary: string;
  events: TimelineEvent[];
};

// -----------------------------------------------------------------------------
// DATA
// -----------------------------------------------------------------------------

// -- Dashboard cases (table rows + hover preview) ------------------------------

export const DASHBOARD_CASES: DashboardCase[] = [
  {
    id: "AUD-0231",
    region: "Hippocampus",
    risk: "High",
    lat: "0.38s",
    status: "Reviewed",
    note: "Strong saliency around hippocampal region.",
    confidence: "78%",
    feature: "Contrast",
    recommendation: "Open MRI viewer for full heatmap review.",
  },
  {
    id: "AUD-0230",
    region: "Hippocampus",
    risk: "Medium",
    lat: "0.41s",
    status: "Pending",
    note: "Moderate activation pattern requiring comparison.",
    confidence: "63%",
    feature: "Homogeneity",
    recommendation: "Compare against prior scan before escalation.",
  },
  {
    id: "AUD-0229",
    region: "Temporal",
    risk: "Low",
    lat: "0.45s",
    status: "Complete",
    note: "Diffuse activation with low-risk temporal pattern.",
    confidence: "34%",
    feature: "Correlation",
    recommendation: "No further MRI review required right now.",
  },
  {
    id: "AUD-0228",
    region: "Hippocampus",
    risk: "High",
    lat: "0.39s",
    status: "Pending",
    note: "Elevated contrast and homogeneity indicators.",
    confidence: "72%",
    feature: "Contrast",
    recommendation: "Clinician review recommended before confirmation.",
  },
];

// -- Viewer page data -----------------------------------------------------------

export const VIEWER_DATA: Record<string, ViewerCase> = {
  "AUD-0231": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.78,
    decision: "High-risk Alzheimer's pattern",
    status: "Reviewed",
    latency: "0.38s",
    summary:
      "The model detected a high-risk bilateral hippocampal pattern with strong texture contrast and reduced structural uniformity.",
    notes:
      "Both hippocampal crops show concentrated saliency near the central hippocampal zone. Contrast remains the strongest feature driver, with supporting reduction in homogeneity. Recommended for clinician review alongside explainability output.",
    recommendation:
      "Review MRI overlays and compare with explainable AI report before final confirmation.",
    defaultPlane: "Axial",
    defaultSlice: 31,
    defaultOverlayOpacity: 0.72,
    features: [
      { name: "Contrast", value: 0.82, color: "bg-red-400" },
      { name: "Homogeneity", value: 0.61, color: "bg-purple-400" },
      { name: "Energy", value: 0.57, color: "bg-emerald-400" },
      { name: "Correlation", value: 0.49, color: "bg-blue-400" },
    ],
  },
  "AUD-0230": {
    datasetClass: "MCI",
    region: "Bilateral Hippocampus",
    confidence: 0.63,
    decision: "Moderate cognitive impairment indication",
    status: "Pending",
    latency: "0.41s",
    summary:
      "The model detected moderate hippocampal irregularity with a broader activation profile than the highest-risk reference case.",
    notes:
      "Activation remains visible on both hippocampal volumes, but spread is wider and less concentrated than the AD reference. Findings suggest follow-up comparison with historical scans before escalation.",
    recommendation:
      "Compare against prior scans and inspect feature attribution before escalation.",
    defaultPlane: "Coronal",
    defaultSlice: 28,
    defaultOverlayOpacity: 0.58,
    features: [
      { name: "Contrast", value: 0.68, color: "bg-red-400" },
      { name: "Homogeneity", value: 0.54, color: "bg-purple-400" },
      { name: "Energy", value: 0.49, color: "bg-emerald-400" },
      { name: "Correlation", value: 0.45, color: "bg-blue-400" },
    ],
  },
  "AUD-0229": {
    datasetClass: "NC",
    region: "Bilateral Hippocampus",
    confidence: 0.34,
    decision: "Low-risk / normal control pattern",
    status: "Complete",
    latency: "0.45s",
    summary:
      "The model observed a low-risk bilateral hippocampal pattern with limited localized saliency and feature values closer to normal-control references.",
    notes:
      "Saliency remains weak and distributed, with feature values closer to lower-risk and normal-control references. No urgent escalation is suggested by current model outputs.",
    recommendation:
      "No urgent review required. Maintain routine workflow and archive result.",
    defaultPlane: "Sagittal",
    defaultSlice: 26,
    defaultOverlayOpacity: 0.42,
    features: [
      { name: "Contrast", value: 0.41, color: "bg-red-400" },
      { name: "Homogeneity", value: 0.36, color: "bg-purple-400" },
      { name: "Energy", value: 0.33, color: "bg-emerald-400" },
      { name: "Correlation", value: 0.29, color: "bg-blue-400" },
    ],
  },
  "AUD-0228": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.72,
    decision: "High-risk case pending review",
    status: "Pending",
    latency: "0.39s",
    summary:
      "The model detected concentrated bilateral hippocampal activation consistent with higher-risk examples.",
    notes:
      "Localized activation remains strong in both hippocampal crops, with elevated contrast and decreased homogeneity contributing most strongly to the decision.",
    recommendation:
      "Review before confirmation and compare with explainability overlays.",
    defaultPlane: "Axial",
    defaultSlice: 34,
    defaultOverlayOpacity: 0.66,
    features: [
      { name: "Contrast", value: 0.79, color: "bg-red-400" },
      { name: "Homogeneity", value: 0.59, color: "bg-purple-400" },
      { name: "Energy", value: 0.55, color: "bg-emerald-400" },
      { name: "Correlation", value: 0.47, color: "bg-blue-400" },
    ],
  },
};

// -- Explainable AI page data ---------------------------------------------------

export const EXPLAIN_DATA: Record<string, ExplainCase> = {
  "AUD-0231": {
    datasetClass: "AD",
    region: "Hippocampus",
    confidence: 0.78,
    decision: "High-risk pattern detected",
    summary:
      "The model identified a strong hippocampal activation pattern supported by elevated texture contrast and reduced structural uniformity.",
    action: "Recommend clinician review with MRI Viewer and saliency overlay.",
    saliency:
      "Saliency is concentrated bilaterally around the hippocampal region, with stronger emphasis on the left-central area across the selected slice range.",
    rationale: [
      "High contrast values indicate stronger local intensity variation.",
      "Reduced homogeneity suggests structural irregularity.",
      "The activation map aligns with the classifier's most informative region.",
    ],
    features: [
      {
        name: "Contrast",
        value: 0.82,
        color: "bg-red-400",
        note: "Primary driver of elevated confidence.",
        tooltip: "Indicates stronger local texture irregularity in the hippocampal region.",
      },
      {
        name: "Homogeneity",
        value: 0.61,
        color: "bg-purple-400",
        note: "Reduced uniformity increases abnormal texture likelihood.",
        tooltip: "Shows lower structural uniformity, often linked to abnormal tissue patterns.",
      },
      {
        name: "Energy",
        value: 0.57,
        color: "bg-emerald-400",
        note: "Moderate support to texture separation.",
        tooltip: "Reflects texture compactness and distribution strength across the scan.",
      },
      {
        name: "Correlation",
        value: 0.49,
        color: "bg-blue-400",
        note: "Secondary supporting feature.",
        tooltip: "Captures spatial dependency patterns that refine the model decision.",
      },
    ],
  },
  "AUD-0230": {
    datasetClass: "MCI",
    region: "Hippocampus",
    confidence: 0.63,
    decision: "Moderate risk indication",
    summary:
      "The model detected moderate hippocampal irregularity, but the activation pattern is less concentrated than the highest-risk reviewed case.",
    action: "Compare against prior scans before escalation.",
    saliency:
      "Activation is present near hippocampal tissue boundaries, but with broader and less intense spread than high-risk cases.",
    rationale: [
      "Moderate contrast elevation suggests some abnormal texture separation.",
      "Homogeneity shift is visible but not severe enough to dominate the decision.",
      "The activation footprint is spatially broader, lowering confidence.",
    ],
    features: [
      {
        name: "Contrast",
        value: 0.68,
        color: "bg-red-400",
        note: "Leading feature, but weaker than reviewed high-risk cases.",
        tooltip: "Shows moderate texture deviation compared with stronger high-risk cases.",
      },
      {
        name: "Homogeneity",
        value: 0.54,
        color: "bg-purple-400",
        note: "Moderate contribution to texture abnormality.",
        tooltip: "Suggests some structural inconsistency, though not strongly dominant.",
      },
      {
        name: "Energy",
        value: 0.49,
        color: "bg-emerald-400",
        note: "Provides moderate separation from lower-risk patterns.",
        tooltip: "Adds moderate discriminative value to the classification outcome.",
      },
      {
        name: "Correlation",
        value: 0.45,
        color: "bg-blue-400",
        note: "Supportive but not dominant.",
        tooltip: "Provides secondary spatial texture context to the model.",
      },
    ],
  },
  "AUD-0229": {
    datasetClass: "NC",
    region: "Temporal",
    confidence: 0.34,
    decision: "Low-risk pattern",
    summary:
      "The model observed diffuse activity with no strong localized saliency in the highest-priority pathological regions.",
    action: "No urgent review required; maintain standard workflow.",
    saliency:
      "Heat concentration is weak and distributed, with no dominant cluster matching the strongest learned Alzheimer-related signatures.",
    rationale: [
      "Lower contrast reduces evidence of strong pathological texture separation.",
      "Homogeneity remains closer to lower-risk reference patterns.",
      "Temporal saliency remains below the internal flagging threshold.",
    ],
    features: [
      {
        name: "Contrast",
        value: 0.41,
        color: "bg-red-400",
        note: "Low contribution relative to flagged cases.",
        tooltip: "Low contrast contribution suggests weaker abnormal texture deviation.",
      },
      {
        name: "Homogeneity",
        value: 0.36,
        color: "bg-purple-400",
        note: "Closer to normal structural consistency patterns.",
        tooltip: "Uniformity remains closer to lower-risk reference scans.",
      },
      {
        name: "Energy",
        value: 0.33,
        color: "bg-emerald-400",
        note: "Limited discriminative strength.",
        tooltip: "Provides only limited support for risk differentiation.",
      },
      {
        name: "Correlation",
        value: 0.29,
        color: "bg-blue-400",
        note: "Minimal influence on decision confidence.",
        tooltip: "Minimal secondary influence on the final model interpretation.",
      },
    ],
  },
  "AUD-0228": {
    datasetClass: "AD",
    region: "Hippocampus",
    confidence: 0.72,
    decision: "High-risk case pending review",
    summary:
      "The model found concentrated hippocampal activation and a strong contrast-driven signature consistent with higher-risk examples.",
    action: "Review before confirmation and compare with viewer overlays.",
    saliency:
      "Saliency remains localized and intense near the hippocampal structure, with noticeable bilateral emphasis across the selected slice zone.",
    rationale: [
      "High contrast remains the strongest quantitative reason for the flag.",
      "Homogeneity reduction supports structural irregularity.",
      "The activation map is compact and concentrated.",
    ],
    features: [
      {
        name: "Contrast",
        value: 0.79,
        color: "bg-red-400",
        note: "Dominant signal associated with higher-risk deviation.",
        tooltip: "Strong local texture contrast is the main reason this case is flagged.",
      },
      {
        name: "Homogeneity",
        value: 0.59,
        color: "bg-purple-400",
        note: "Supports irregular structural texture interpretation.",
        tooltip: "Lower homogeneity supports abnormal structural variation.",
      },
      {
        name: "Energy",
        value: 0.55,
        color: "bg-emerald-400",
        note: "Adds moderate discrimination strength.",
        tooltip: "Energy reinforces texture separation but is not the primary driver.",
      },
      {
        name: "Correlation",
        value: 0.47,
        color: "bg-blue-400",
        note: "Secondary influence in final attribution.",
        tooltip: "Provides supporting spatial texture relationships to refine the decision.",
      },
    ],
  },
};

// -- Reports page data ----------------------------------------------------------

export const REPORT_DATA: Record<string, ReportCase> = {
  "AUD-0231": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.78,
    decision: "High-risk Alzheimer's pattern",
    status: "Reviewed",
    latency: "0.38s",
    summary:
      "The system detected a high-risk bilateral hippocampal texture pattern consistent with Alzheimer-related structural irregularity.",
    notes:
      "Both hippocampal crops show concentrated saliency and elevated contrast values. Reduced homogeneity supports the classifier decision and increases confidence in the high-risk assessment.",
    recommendation:
      "Clinician review is recommended with MRI overlay inspection and explainability verification before final confirmation.",
    explainability:
      "Feature attribution indicates Contrast as the strongest contributor, followed by Homogeneity and Energy. Saliency remains localized near the central hippocampal structure in both channels.",
    preprocessing:
      "Raw .bin scan converted to NumPy volume and normalized into bilateral hippocampal crops.",
    volumeShape: "2 -- 64 -- 64 -- 64",
    features: [
      { name: "Contrast", value: 0.82, color: "bg-red-400", note: "Primary driver of the classification outcome." },
      { name: "Homogeneity", value: 0.61, color: "bg-purple-400", note: "Reduced structural uniformity supports abnormal texture interpretation." },
      { name: "Energy", value: 0.57, color: "bg-emerald-400", note: "Moderate contribution to feature separability." },
      { name: "Correlation", value: 0.49, color: "bg-blue-400", note: "Secondary supporting feature." },
    ],
  },
  "AUD-0230": {
    datasetClass: "MCI",
    region: "Bilateral Hippocampus",
    confidence: 0.63,
    decision: "Moderate cognitive impairment indication",
    status: "Pending",
    latency: "0.41s",
    summary:
      "The system detected moderate bilateral hippocampal irregularity with lower concentration and lower certainty than high-risk Alzheimer cases.",
    notes:
      "Activation is visible in both hippocampal crops, but the saliency distribution is broader and less compact than the AD reference case. Findings suggest intermediate abnormality.",
    recommendation:
      "Compare against historical scans and confirm with explainability review before escalation.",
    explainability:
      "Feature attribution indicates Contrast and Homogeneity as the leading contributors. The saliency footprint is present but more diffuse than in reviewed high-risk cases.",
    preprocessing:
      "Raw .bin scan converted to NumPy volume and standardized into bilateral hippocampal crops.",
    volumeShape: "2 -- 64 -- 64 -- 64",
    features: [
      { name: "Contrast", value: 0.68, color: "bg-red-400", note: "Leading discriminative feature for this case." },
      { name: "Homogeneity", value: 0.54, color: "bg-purple-400", note: "Supports moderate texture abnormality." },
      { name: "Energy", value: 0.49, color: "bg-emerald-400", note: "Moderate separability contribution." },
      { name: "Correlation", value: 0.45, color: "bg-blue-400", note: "Supportive but not dominant." },
    ],
  },
  "AUD-0229": {
    datasetClass: "NC",
    region: "Bilateral Hippocampus",
    confidence: 0.34,
    decision: "Low-risk / normal control pattern",
    status: "Complete",
    latency: "0.45s",
    summary:
      "The system observed a low-risk bilateral hippocampal pattern with limited localized saliency and feature values closer to normal-control references.",
    notes:
      "No strong, compact hippocampal abnormality was identified. Texture features remain below high-priority thresholds and do not suggest urgent escalation.",
    recommendation:
      "No urgent clinician escalation required. Archive result under routine workflow.",
    explainability:
      "Low contrast contribution and relatively preserved homogeneity reduce the probability of a high-risk classification. Saliency remains weak and diffuse.",
    preprocessing:
      "Raw .bin scan converted to NumPy volume and normalized into bilateral hippocampal crops.",
    volumeShape: "2 -- 64 -- 64 -- 64",
    features: [
      { name: "Contrast", value: 0.41, color: "bg-red-400", note: "Low discriminative strength relative to flagged cases." },
      { name: "Homogeneity", value: 0.36, color: "bg-purple-400", note: "Closer to normal structural consistency." },
      { name: "Energy", value: 0.33, color: "bg-emerald-400", note: "Limited contribution to separation." },
      { name: "Correlation", value: 0.29, color: "bg-blue-400", note: "Minimal effect on final confidence." },
    ],
  },
  "AUD-0228": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.72,
    decision: "High-risk case pending review",
    status: "Pending",
    latency: "0.39s",
    summary:
      "The system detected concentrated bilateral hippocampal activation and a strong contrast-driven texture signature consistent with higher-risk examples.",
    notes:
      "Both channels show strong localized activation and reduced structural uniformity. The observed pattern is consistent with cases requiring clinician review.",
    recommendation:
      "Review with MRI overlays and feature attribution before final confirmation.",
    explainability:
      "Contrast remains the dominant driver, supported by reduced Homogeneity and moderate Energy contribution. Saliency appears compact and centered in the hippocampal region.",
    preprocessing:
      "Raw .bin scan converted to NumPy volume and cropped into left/right hippocampal sub-volumes.",
    volumeShape: "2 -- 64 -- 64 -- 64",
    features: [
      { name: "Contrast", value: 0.79, color: "bg-red-400", note: "Dominant feature associated with high-risk deviation." },
      { name: "Homogeneity", value: 0.59, color: "bg-purple-400", note: "Supports irregular structural interpretation." },
      { name: "Energy", value: 0.55, color: "bg-emerald-400", note: "Adds moderate feature separation strength." },
      { name: "Correlation", value: 0.47, color: "bg-blue-400", note: "Secondary influence in the final decision." },
    ],
  },
};

// -- Risk Stratification Heatmap data ------------------------------------------

export type HeatmapCase = {
  id: string;
  region: "Hippocampus" | "Entorhinal" | "Temporal" | "Prefrontal" | "Parietal" | "Frontal";
  confidence: number;  // 0---1
  risk: RiskLevel;
  feature: string;
  latency: string;
};

export const HEATMAP_CASES: HeatmapCase[] = [
  // Hippocampus --- dense cluster, mostly high risk
  { id: "AUD-0231", region: "Hippocampus",  confidence: 0.78, risk: "High",   feature: "Contrast",     latency: "0.38s" },
  { id: "AUD-0228", region: "Hippocampus",  confidence: 0.72, risk: "High",   feature: "Contrast",     latency: "0.39s" },
  { id: "AUD-0230", region: "Hippocampus",  confidence: 0.63, risk: "Medium", feature: "Homogeneity",  latency: "0.41s" },
  { id: "AUD-0227", region: "Hippocampus",  confidence: 0.81, risk: "High",   feature: "Contrast",     latency: "0.37s" },
  { id: "AUD-0224", region: "Hippocampus",  confidence: 0.55, risk: "Medium", feature: "Energy",       latency: "0.43s" },
  { id: "AUD-0221", region: "Hippocampus",  confidence: 0.29, risk: "Low",    feature: "Correlation",  latency: "0.46s" },
  // Entorhinal --- moderate spread
  { id: "AUD-0226", region: "Entorhinal",   confidence: 0.74, risk: "High",   feature: "Contrast",     latency: "0.40s" },
  { id: "AUD-0223", region: "Entorhinal",   confidence: 0.58, risk: "Medium", feature: "Homogeneity",  latency: "0.44s" },
  { id: "AUD-0220", region: "Entorhinal",   confidence: 0.42, risk: "Medium", feature: "Energy",       latency: "0.47s" },
  { id: "AUD-0217", region: "Entorhinal",   confidence: 0.22, risk: "Low",    feature: "Correlation",  latency: "0.49s" },
  // Temporal --- mixed
  { id: "AUD-0229", region: "Temporal",     confidence: 0.34, risk: "Low",    feature: "Correlation",  latency: "0.45s" },
  { id: "AUD-0225", region: "Temporal",     confidence: 0.61, risk: "Medium", feature: "Homogeneity",  latency: "0.42s" },
  { id: "AUD-0219", region: "Temporal",     confidence: 0.77, risk: "High",   feature: "Contrast",     latency: "0.38s" },
  { id: "AUD-0215", region: "Temporal",     confidence: 0.18, risk: "Low",    feature: "Correlation",  latency: "0.51s" },
  // Prefrontal --- lower risk overall
  { id: "AUD-0222", region: "Prefrontal",   confidence: 0.48, risk: "Medium", feature: "Energy",       latency: "0.45s" },
  { id: "AUD-0218", region: "Prefrontal",   confidence: 0.31, risk: "Low",    feature: "Homogeneity",  latency: "0.48s" },
  { id: "AUD-0214", region: "Prefrontal",   confidence: 0.67, risk: "High",   feature: "Contrast",     latency: "0.41s" },
  // Parietal
  { id: "AUD-0216", region: "Parietal",     confidence: 0.53, risk: "Medium", feature: "Energy",       latency: "0.44s" },
  { id: "AUD-0213", region: "Parietal",     confidence: 0.25, risk: "Low",    feature: "Correlation",  latency: "0.50s" },
  // Frontal --- mostly low risk
  { id: "AUD-0212", region: "Frontal",      confidence: 0.19, risk: "Low",    feature: "Homogeneity",  latency: "0.52s" },
  { id: "AUD-0211", region: "Frontal",      confidence: 0.38, risk: "Low",    feature: "Energy",       latency: "0.47s" },
  { id: "AUD-0210", region: "Frontal",      confidence: 0.70, risk: "High",   feature: "Contrast",     latency: "0.40s" },
];

// -- Timeline page data ---------------------------------------------------------

export const TIMELINE_DATA: Record<string, TimelineCase> = {
  "AUD-0231": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.78,
    decision: "High-risk Alzheimer's pattern",
    status: "Reviewed",
    latency: "0.38s",
    summary:
      "This case progressed through the full bilateral hippocampal analysis workflow and is currently marked as reviewed.",
    events: [
      { title: "MRI volume uploaded", time: "09:14 AM", status: "Complete", description: "Raw scan entered the workflow and was registered for hippocampal processing.", icon: "upload" },
      { title: "Preprocessing complete", time: "09:15 AM", status: "Complete", description: "Raw .bin converted to NumPy format and cropped into bilateral hippocampal volumes.", icon: "preprocess" },
      { title: "Radiomics extraction", time: "09:15 AM", status: "Complete", description: "3D GLCM feature extraction executed for both hippocampal channels.", icon: "radiomics" },
      { title: "Classifier output generated", time: "09:16 AM", status: "Complete", description: "Prediction confidence reached 78% with contrast-driven abnormality pattern.", icon: "classify" },
      { title: "Clinical report prepared", time: "09:17 AM", status: "Complete", description: "Structured summary and explainability highlights prepared for review.", icon: "report" },
      { title: "Clinician review", time: "09:22 AM", status: "Active", description: "Case marked as reviewed with recommendation for confirmation against overlays.", icon: "review" },
    ],
  },
  "AUD-0230": {
    datasetClass: "MCI",
    region: "Bilateral Hippocampus",
    confidence: 0.63,
    decision: "Moderate cognitive impairment indication",
    status: "Pending",
    latency: "0.41s",
    summary:
      "This case completed automated analysis and remains pending final clinical confirmation.",
    events: [
      { title: "MRI volume uploaded", time: "11:03 AM", status: "Complete", description: "Case was registered and queued for bilateral hippocampal processing.", icon: "upload" },
      { title: "Preprocessing complete", time: "11:04 AM", status: "Complete", description: "Conversion to NumPy completed with standardized hippocampal volume preparation.", icon: "preprocess" },
      { title: "Radiomics extraction", time: "11:05 AM", status: "Complete", description: "Feature extraction completed with moderate contrast and homogeneity deviation.", icon: "radiomics" },
      { title: "Classifier output generated", time: "11:05 AM", status: "Complete", description: "Moderate-risk pattern detected with 63% confidence.", icon: "classify" },
      { title: "Clinical report prepared", time: "11:06 AM", status: "Active", description: "Report is available, awaiting comparison against previous scans.", icon: "report" },
      { title: "Clinician review", time: "Pending", status: "Pending", description: "Awaiting final interpretation and escalation decision.", icon: "review" },
    ],
  },
  "AUD-0229": {
    datasetClass: "NC",
    region: "Bilateral Hippocampus",
    confidence: 0.34,
    decision: "Low-risk / normal control pattern",
    status: "Complete",
    latency: "0.45s",
    summary:
      "This case completed normal-control analysis with low-risk results and no urgent escalation required.",
    events: [
      { title: "MRI volume uploaded", time: "02:08 PM", status: "Complete", description: "Volume was registered and entered into the processing queue.", icon: "upload" },
      { title: "Preprocessing complete", time: "02:09 PM", status: "Complete", description: "Scan converted to NumPy and normalized for bilateral hippocampal evaluation.", icon: "preprocess" },
      { title: "Radiomics extraction", time: "02:09 PM", status: "Complete", description: "Low-priority texture characteristics detected across both channels.", icon: "radiomics" },
      { title: "Classifier output generated", time: "02:10 PM", status: "Complete", description: "Low-risk prediction issued with 34% confidence and diffuse saliency.", icon: "classify" },
      { title: "Clinical report prepared", time: "02:11 PM", status: "Complete", description: "Routine summary generated and archived under standard workflow.", icon: "report" },
      { title: "Clinician review", time: "Not required", status: "Complete", description: "No urgent escalation recommended based on current model outputs.", icon: "review" },
    ],
  },
  "AUD-0228": {
    datasetClass: "AD",
    region: "Bilateral Hippocampus",
    confidence: 0.72,
    decision: "High-risk case pending review",
    status: "Pending",
    latency: "0.39s",
    summary:
      "This case completed the automated pipeline and remains pending final clinical confirmation.",
    events: [
      { title: "MRI volume uploaded", time: "03:42 PM", status: "Complete", description: "Case registered for bilateral hippocampal analysis.", icon: "upload" },
      { title: "Preprocessing complete", time: "03:43 PM", status: "Complete", description: "Bilateral hippocampal volumes prepared from the source scan.", icon: "preprocess" },
      { title: "Radiomics extraction", time: "03:43 PM", status: "Complete", description: "Feature extraction showed elevated contrast and reduced homogeneity.", icon: "radiomics" },
      { title: "Classifier output generated", time: "03:44 PM", status: "Complete", description: "High-risk decision produced with 72% confidence.", icon: "classify" },
      { title: "Clinical report prepared", time: "03:45 PM", status: "Active", description: "Explainability summary is ready for clinician inspection.", icon: "report" },
      { title: "Clinician review", time: "Pending", status: "Pending", description: "Awaiting review before final confirmation.", icon: "review" },
    ],
  },
};
