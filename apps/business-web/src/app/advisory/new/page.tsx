import Link from 'next/link';
import { BusinessShell } from '../../../components/business-shell';
import { AdvisoryForm } from '../advisory-form';
import { createAdvisoryRuleAction } from '../actions';

export default function NewAdvisoryPage() {
  return (
    <BusinessShell active="advisory" eyebrow="Advisory authoring" statuses={[{ label: 'Draft workflow', tone: 'warn' }]} title="Create Advisory Rule">
      <div className="breadcrumbRow"><p className="mutedText">Create bilingual, crop-stage guidance with explicit eligibility and a traceable source.</p><Link className="textLink" href="/advisory">Back to rules</Link></div>
      <AdvisoryForm action={createAdvisoryRuleAction} submitLabel="Save draft" />
    </BusinessShell>
  );
}
