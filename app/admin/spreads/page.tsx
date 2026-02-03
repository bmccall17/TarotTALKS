import { SpreadsManagement } from '@/components/admin/spreads/SpreadsManagement';

export default function SpreadsPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Spreads Management</h1>
          <p className="text-gray-400 mt-2">
            Monitor and manage spread data, cleanup orphaned records
          </p>
        </div>

        <SpreadsManagement />
      </div>
    </div>
  );
}
