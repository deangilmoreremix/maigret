# AI Creative Personalizer Module

Centralized personalization pop-up for VideoRemix.vip and affiliated LLM apps.

## Files
- `PersonalizerDialog.tsx` - Main pop-up UI component
- `VideoRemixPersonalizer.tsx` - React SDK component
- `widget.js` - Embeddable JavaScript widget
- `netlify-functions-personalizer-api.js` - API endpoints (rename to `personalizer-api.js` in `netlify/functions/`)
- `supabase-migration.sql` - Database setup
- `index.ts` - Module exports

## Installation
1. Copy files to your videoremix.vip2 project:
   ```bash
   cp PersonalizerDialog.tsx /path/to/videoremix.vip2/src/components/personalizer/
   cp VideoRemixPersonalizer.tsx /path/to/videoremix.vip2/src/components/personalizer/
   cp widget.js /path/to/videoremix.vip2/public/
   cp netlify-functions-personalizer-api.js /path/to/videoremix.vip2/netlify/functions/personalizer-api.js
   cp index.ts /path/to/videoremix.vip2/src/components/personalizer/
   ```

2. Run Supabase migration:
   - Copy `supabase-migration.sql` content to Supabase SQL Editor
   - Execute to create tables and RLS policies

3. Set environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional, for real generation)

## Usage
### React Component
```tsx
import { VideoRemixPersonalizer } from './components/personalizer';

<VideoRemixPersonalizer
  appId="videoremix-vip"
  mode="cold-email"
  defaultTone="professional"
  onComplete={(output) => console.log(output)}
/>
```

### JavaScript Widget
```html
<script src="/widget.js"></script>
<script>
  VideoRemixPersonalizer.init({ appId: 'videoremix-vip' }).open();
</script>
```

## Features
- 8 MVP modes (cold-email, video-email, proposal, etc.)
- 10 MVP app integrations
- Dark glassmorphism UI matching VideoRemix.vip
- Optional public profile scanning (GitHub API)
- Deep link support: `/new?app=APP_ID&mode=MODE`
- Row Level Security (RLS) enabled
- No secret keys in frontend
