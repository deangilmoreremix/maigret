import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting store (in-memory for demo)
const rateLimit = new Map();
const RATE_LIMIT = 10; // requests per minute
const WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];
  const recent = userRequests.filter(t => now - t < WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

// GitHub API profile check
async function checkGitHub(username) {
  try {
    const res = await fetch(`https://api.github.com/users/${username}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      platform: 'github',
      exists: true,
      public_repos: data.public_repos,
      followers: data.followers,
      bio: data.bio,
      company: data.company
    };
  } catch {
    return null;
  }
}

// Maigret Worker Integration
async function callMaigretWorker(username, maigretUrl, maigretSecret) {
  const res = await fetch(`${maigretUrl}/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${maigretSecret}`
    },
    body: JSON.stringify({ username })
  });
  if (!res.ok) throw new Error(`Maigret worker failed: ${res.statusText}`);
  return await res.json();
}

// AI Generation Helpers
async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(apiKey, systemPrompt, userPrompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
      }],
      generationConfig: { temperature: 0.7 }
    })
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

export async function handler(event, context) {
  const ip = event.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/api/personalizer', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // /api/personalizer/scan
    if (path === '/scan' && event.httpMethod === 'POST') {
      const { targetName } = body;
      if (!targetName) throw new Error('targetName required');

      let scanData;
      // Try Maigret worker first if configured
      if (process.env.MAIGRET_WORKER_URL && process.env.MAIGRET_WORKER_SECRET) {
        try {
          scanData = await callMaigretWorker(targetName, process.env.MAIGRET_WORKER_URL, process.env.MAIGRET_WORKER_SECRET);
        } catch (maigretError) {
          console.error('Maigret worker failed, falling back to GitHub:', maigretError);
          const github = await checkGitHub(targetName);
          scanData = github ? {
            summary: `Public presence suggests professional activity on GitHub (${github.public_repos} repos)`,
            platforms: [github],
            confidence: 0.8
          } : null;
        }
      } else {
        // Fallback to GitHub only
        const github = await checkGitHub(targetName);
        scanData = github ? {
          summary: `Public presence suggests professional activity on GitHub (${github.public_repos} repos)`,
          platforms: [github],
          confidence: 0.8
        } : null;
      }

      if (!scanData) {
        scanData = {
          summary: 'No public scan data found',
          platforms: [],
          confidence: 0.0
        };
      }

      const { data: scan } = await supabase
        .from('profile_scan_results')
        .insert({
          user_id: body.userId,
          target_name: targetName,
          scan_data: scanData
        })
        .select()
        .single();

      return { statusCode: 200, headers, body: JSON.stringify({ scanId: scan.id, scanData }) };
    }

    // /api/personalizer/generate
    if (path === '/generate' && event.httpMethod === 'POST') {
      const { appId, mode, targetName, targetCompany, manualNotes, offer, goal, tone, cta, projectId } = body;
      if (!targetName || !mode) throw new Error('targetName and mode required');

      // Get or create project
      let project;
      if (projectId) {
        const { data } = await supabase
          .from('personalization_projects')
          .select('*')
          .eq('id', projectId)
          .single();
        project = data;
      } else {
        const { data } = await supabase
          .from('personalization_projects')
          .insert({
            user_id: body.userId,
            app_id: appId,
            mode,
            target_name: targetName,
            target_company: targetCompany,
            manual_notes: manualNotes,
            status: 'generating'
          })
          .select()
          .single();
        project = data;
      }

      // Get scan data if available
      let scanData = null;
      if (project.scan_id) {
        const { data } = await supabase
          .from('profile_scan_results')
          .select('scan_data')
          .eq('id', project.scan_id)
          .single();
        scanData = data?.scan_data;
      }

      // Get prompt templates
      const { data: templates } = await supabase
        .from('personalizer_templates')
        .select('*')
        .eq('app_id', appId)
        .eq('mode', mode);

      const systemPrompt = templates?.find(t => t.template_type === 'system')?.content || 'You are a helpful assistant that generates personalized business content.';
      let userPrompt = templates?.find(t => t.template_type === 'user')?.content || `Generate a ${mode} for ${targetName}`;

      // Replace variables in user prompt
      userPrompt = userPrompt
        .replace(/\{\{targetName\}\}/g, targetName)
        .replace(/\{\{targetCompany\}\}/g, targetCompany || 'N/A')
        .replace(/\{\{manualNotes\}\}/g, manualNotes || 'N/A')
        .replace(/\{\{scanData\}\}/g, scanData ? JSON.stringify(scanData, null, 2) : 'No scan data available')
        .replace(/\{\{offer\}\}/g, offer || 'N/A')
        .replace(/\{\{goal\}\}/g, goal || 'N/A')
        .replace(/\{\{tone\}\}/g, tone || 'professional')
        .replace(/\{\{cta\}\}/g, cta || 'N/A');

      // Generate content with AI
      let generatedContent;
      try {
        if (process.env.OPENAI_API_KEY) {
          generatedContent = await callOpenAI(process.env.OPENAI_API_KEY, systemPrompt, userPrompt);
        } else {
          throw new Error('OpenAI API key not configured');
        }
      } catch (openaiError) {
        console.error('OpenAI generation failed:', openaiError);
        try {
          if (process.env.GEMINI_API_KEY) {
            generatedContent = await callGemini(process.env.GEMINI_API_KEY, systemPrompt, userPrompt);
          } else {
            throw new Error('Gemini API key not configured');
          }
        } catch (geminiError) {
          console.error('Gemini generation failed:', geminiError);
          // Fallback content
          generatedContent = `Generated ${mode} for ${targetName} at ${targetCompany || 'N/A'}.\n\nNotes: ${manualNotes || 'None'}\n\nScan Data: ${scanData ? JSON.stringify(scanData, null, 2) : 'None'}`;
        }
      }

      const output = {
        type: mode,
        content: generatedContent,
        metadata: { tone, offer, goal, cta, scanData }
      };

      // Save output
      await supabase
        .from('personalization_outputs')
        .insert({
          project_id: project.id,
          output_type: mode,
          content: output
        });

      // Update project status
      await supabase
        .from('personalization_projects')
        .update({ status: 'complete' })
        .eq('id', project.id);

      return { statusCode: 200, headers, body: JSON.stringify({ output, project }) };
    }

    // /api/personalizer/apps
    if (path === '/apps' && event.httpMethod === 'GET') {
      const { data } = await supabase
        .from('personalizer_apps')
        .select('*');
      return { statusCode: 200, headers, body: JSON.stringify(data || [
        { id: 'videoremix-vip', name: 'VideoRemix.vip' },
        { id: 'sales-assistant-pro', name: 'Sales Assistant Pro' },
        { id: 'proposal-generator', name: 'Proposal Generator' }
      ]) };
    }

    // /api/personalizer/history
    if (path === '/history' && event.httpMethod === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (!userId) throw new Error('userId required');
      const { data } = await supabase
        .from('personalization_projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // /api/personalizer/output/:id
    if (path.match(/\/output\/([^\/]+)$/) && event.httpMethod === 'GET') {
      const projectId = path.match(/\/output\/([^\/]+)$/)[1];
      const { data } = await supabase
        .from('personalization_outputs')
        .select('*')
        .eq('project_id', projectId)
        .single();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // /api/personalizer/save
    if (path === '/save' && event.httpMethod === 'POST') {
      const { projectId } = body;
      if (!projectId) throw new Error('projectId required');
      const { data } = await supabase
        .from('personalization_projects')
        .update({ status: 'saved' })
        .eq('id', projectId)
        .select()
        .single();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // /api/personalizer/send-to-app
    if (path === '/send-to-app' && event.httpMethod === 'POST') {
      const { projectId, appId } = body;
      if (!projectId || !appId) throw new Error('projectId and appId required');
      // Get output
      const { data: output } = await supabase
        .from('personalization_outputs')
        .select('*')
        .eq('project_id', projectId)
        .single();
      if (!output) throw new Error('Output not found');
      // Generate deep link
      const deepLink = `https://videoremix.vip/app/${appId}?personalization=${projectId}`;
      return { statusCode: 200, headers, body: JSON.stringify({ deepLink, output: output.content }) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Endpoint not found' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
