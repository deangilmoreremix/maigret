import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface PersonalizerDialogProps {
  open: boolean;
  onClose: () => void;
  appId?: string;
  mode?: string;
  userId?: string;
  projectId?: string;
  defaultOffer?: string;
  defaultGoal?: string;
  defaultTone?: string;
  defaultCTA?: string;
  initialTarget?: string;
  onComplete?: (output: any) => void;
  onSave?: (projectId: string) => void;
  theme?: any;
}

const STEPS = [
  { id: 1, name: 'Select App & Mode' },
  { id: 2, name: 'Target Info' },
  { id: 3, name: 'Public Scan (Optional)' },
  { id: 4, name: 'Manual Notes' },
  { id: 5, name: 'Generate' },
  { id: 6, name: 'Output' },
  { id: 7, name: 'Save' },
  { id: 8, name: 'Send to App' }
];

export default function PersonalizerDialog({
  open,
  onClose,
  appId: initialAppId,
  mode: initialMode,
  userId,
  projectId,
  defaultOffer,
  defaultGoal,
  defaultTone = 'professional',
  defaultCTA,
  initialTarget,
  onComplete,
  onSave,
  theme
}: PersonalizerDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [appId, setAppId] = useState(initialAppId || 'videoremix-vip');
  const [mode, setMode] = useState(initialMode || 'cold-email');
  const [targetName, setTargetName] = useState(initialTarget || '');
  const [targetCompany, setTargetCompany] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState(null);
  const [project, setProject] = useState(null);
  const [deepLink, setDeepLink] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  useEffect(() => {
    if (open && projectId) {
      loadProject(projectId);
    }
  }, [open, projectId]);

  const loadProject = async (id: string) => {
    const { data } = await supabase
      .from('personalization_projects')
      .select('*')
      .eq('id', id)
      .single();
    if (data) {
      setProject(data);
      setAppId(data.app_id);
      setMode(data.mode);
      setTargetName(data.target_name);
      setTargetCompany(data.target_company || '');
      setManualNotes(data.manual_notes || '');
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/personalizer/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ targetName, targetCompany })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setProject((prev: any) => ({ ...prev, scan_id: data.scanId }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/personalizer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          appId,
          mode,
          targetName,
          targetCompany,
          manualNotes,
          offer: defaultOffer,
          goal: defaultGoal,
          tone: defaultTone,
          cta: defaultCTA
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutput(data.output);
      setProject(data.project);
      setCurrentStep(6);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/personalizer/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ projectId: project?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave?.(project?.id);
      setCurrentStep(7);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendToApp = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/personalizer/send-to-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ projectId: project?.id, appId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send to app failed');
      setDeepLink(data.deepLink);
      setSendStatus('success');
    } catch (err: any) {
      setSendStatus(`Error: ${err.message}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl h-[90vh] bg-gray-900/80 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800/50 border-r border-purple-500/20 p-4">
          <div className="mb-6">
            <h3 className="text-purple-300 font-semibold">AI Creative Personalizer</h3>
            <p className="text-xs text-gray-400">App: {appId}</p>
            <p className="text-xs text-gray-400">Mode: {mode}</p>
          </div>
          <div className="space-y-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`p-2 rounded-lg text-sm ${
                  currentStep === step.id
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                    : currentStep > step.id
                    ? 'bg-emerald-600/20 text-emerald-200'
                    : 'bg-gray-700/30 text-gray-400'
                }`}
              >
                {step.id}. {step.name}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-purple-500/20">
            <p className="text-xs text-gray-400">Scan status: {project?.scan_id ? 'Complete' : 'Not run'}</p>
            <p className="text-xs text-gray-400">Project: {project?.id ? 'Active' : 'New'}</p>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Personalize Content</h2>
              <p className="text-sm text-gray-400">Step {currentStep} of 8</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">App</label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg p-2 text-white"
                >
                  <option value="videoremix-vip">VideoRemix.vip</option>
                  <option value="sales-assistant-pro">Sales Assistant Pro</option>
                  <option value="proposal-generator">Proposal Generator</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg p-2 text-white"
                >
                  <option value="cold-email">Cold Email</option>
                  <option value="video-email">Video Email</option>
                  <option value="proposal">Proposal</option>
                  <option value="sales-page">Sales Page</option>
                </select>
              </div>
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold"
              >
                Next
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Target Name</label>
                <input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg p-2 text-white"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Target Company</label>
                <input
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg p-2 text-white"
                  placeholder="Acme Inc."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-gray-300">Optional: Scan public profiles for {targetName}</p>
              <button
                onClick={handleScan}
                disabled={isScanning || !targetName}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg text-white"
              >
                {isScanning ? 'Scanning...' : 'Run Public Scan'}
              </button>
              <p className="text-xs text-gray-400">Uses Maigret worker (if configured) or GitHub API. LinkedIn/Twitter checks coming soon.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold"
                >
                  Skip / Next
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Manual Notes</label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full bg-gray-800/50 border border-purple-500/30 rounded-lg p-2 text-white h-32"
                  placeholder="Add any manual notes about the target..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg text-white">Ready to Generate</h3>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <p className="text-sm text-gray-300">Target: {targetName}</p>
                <p className="text-sm text-gray-300">Mode: {mode}</p>
                <p className="text-sm text-gray-300">Tone: {defaultTone}</p>
                {project?.scan_id && <p className="text-sm text-emerald-300">Scan data included</p>}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !targetName}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 rounded-lg text-white font-semibold"
              >
                {isGenerating ? 'Generating...' : 'Generate Content'}
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
              >
                Back
              </button>
            </div>
          )}

          {currentStep === 6 && output && (
            <div className="space-y-4">
              <h3 className="text-lg text-white">Generated Output</h3>
              <div className="bg-gray-800/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-200 whitespace-pre-wrap">{typeof output.content === 'string' ? output.content : JSON.stringify(output.content, null, 2)}</pre>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-semibold"
                >
                  Save Output
                </button>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg text-white">Project Saved</h3>
              <p className="text-sm text-gray-300">Your project has been saved successfully.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(6)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(8)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold"
                >
                  Proceed to Send to App
                </button>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-lg text-white">Send to App</h3>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <p className="text-sm text-gray-300">Output Content:</p>
                <pre className="text-sm text-gray-200 whitespace-pre-wrap mt-2">{typeof output?.content === 'string' ? output.content : JSON.stringify(output?.content, null, 2)}</pre>
              </div>
              {deepLink ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">Deep Link:</p>
                  <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
                    {deepLink}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deepLink);
                      setSendStatus('Deep link copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    Copy Deep Link
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSendToApp}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-semibold"
                >
                  Generate Deep Link
                </button>
              )}
              {sendStatus && (
                <p className={`text-sm ${sendStatus.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {sendStatus}
                </p>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(typeof output?.content === 'string' ? output.content : JSON.stringify(output?.content, null, 2));
                  setSendStatus('Output copied to clipboard!');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm"
              >
                Copy Output Content
              </button>
              <button
                onClick={() => setCurrentStep(7)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold"
              >
                Back
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-8 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-400">
              *This tool uses public or user-provided information to help generate business-relevant personalization. Results may include possible matches and should be reviewed before use. Do not use this tool for harassment, surveillance, sensitive profiling, or unlawful purposes.
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-72 bg-gray-800/50 border-l border-purple-500/20 p-4">
          <h3 className="text-purple-300 font-semibold mb-4">AI Suggestions</h3>
          <div className="space-y-3">
            <button className="w-full p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg text-sm text-purple-200">
              Refine Tone
            </button>
            <button className="w-full p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg text-sm text-purple-200">
              Add Offer
            </button>
          </div>
          {output && (
            <div className="mt-6 pt-4 border-t border-purple-500/20">
              <h4 className="text-sm text-gray-300 mb-2">Quick Actions</h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(typeof output.content === 'string' ? output.content : JSON.stringify(output.content, null, 2));
                }}
                className="w-full p-2 bg-cyan-600/30 hover:bg-cyan-600/40 rounded-lg text-sm text-cyan-200 mb-2"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setCurrentStep(8)}
                className="w-full p-2 bg-purple-600/30 hover:bg-purple-600/40 rounded-lg text-sm text-purple-200"
              >
                Send to App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
