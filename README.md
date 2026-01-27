# Invoice/AP Automation Platform

Enterprise-grade invoice processing and accounts payable automation system built with Next.js, Supabase, and OpenAI GPT-4 Vision.

## Features

- **Smart PDF Extraction**: GPT-4 Vision API for accurate data extraction from scanned invoices
- **Comprehensive Data Schema**: Full invoice structure with confidence scoring
- **Exception Management**: Automated validation with manual review queue
- **Dual CSV Export**: Header-based and line-item formats for ERP integration
- **Audit Trail**: Complete change tracking with user attribution
- **Real-time Processing**: Background job processing with status updates

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **OCR/AI**: OpenAI GPT-4 Vision API
- **Storage**: Local file system (S3-ready)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- OpenAI API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/sharathodepalli/invoice_ops.git
cd invoice_ops/invoice-app
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Set up the database:

```bash
# Run the SQL scripts in supabase/
# 1. setup.sql
# 2. seed.sql (optional)
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

### Data Pipeline

1. **Upload** → PDF files saved to `/uploads`
2. **OCR Detection** → Identifies image-based PDFs
3. **AI Extraction** → GPT-4 Vision extracts all invoice fields
4. **Validation** → Rule-based checks for completeness and accuracy
5. **Exception Queue** → Flagged items for manual review
6. **Approval** → User review and field correction
7. **Export** → CSV generation for ERP import

### Database Schema

- `jobs` - Processing job tracking
- `invoices` - Extracted invoice data with full JSON
- `validation_flags` - Exception tracking
- `audit_logs` - Change history
- `export_records` - Export history

## API Endpoints

- `POST /api/upload` - Upload and process invoice
- `GET /api/invoices` - List invoices with filters
- `GET /api/invoices/:id` - Get invoice details
- `PATCH /api/invoices/:id` - Update invoice fields
- `POST /api/invoices/:id/approve` - Approve invoice
- `POST /api/invoices/:id/reject` - Reject invoice
- `GET /api/export` - Export invoices to CSV

## Project Structure

```
invoice-app/
├── src/
│   ├── app/              # Next.js pages and API routes
│   ├── components/       # React components
│   ├── lib/             # Core business logic
│   │   ├── ocr.ts       # PDF detection
│   │   ├── extraction.ts # GPT-4 Vision integration
│   │   ├── confidence.ts # Confidence scoring
│   │   ├── validation.ts # Business rules
│   │   └── processor.ts  # Job orchestration
│   └── types/           # TypeScript definitions
├── supabase/            # Database scripts
└── public/              # Static assets
```

## Development

### Key Files

- `src/lib/extraction.ts` - AI extraction logic
- `src/lib/confidence.ts` - Confidence calculation engine
- `src/types/full-invoice.ts` - Canonical invoice schema
- `src/lib/validation.ts` - Validation rules

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment

The application is ready for deployment to:

- Vercel (recommended for Next.js)
- AWS (EC2/ECS)
- Docker containers

## License

MIT

## Contributing

Pull requests welcome! Please ensure:

- TypeScript types are complete
- No console errors
- Tests pass
- Code follows existing patterns

## Support

For issues and questions, please open a GitHub issue.
