'use client';

import { Star, Edit2, Trash2, ArrowUp, ExternalLink } from 'lucide-react';

type Mapping = {
  id: string;
  cardId: string;
  talkId: string;
  isPrimary: boolean;
  strength: number;
  rationaleShort: string;
  rationaleLong: string | null;
  createdAt: string;
  talkTitle: string;
  talkSlug: string;
  talkSpeakerName: string;
  talkThumbnailUrl: string | null;
  talkYear: number | null;
  talkIsDeleted: boolean;
};

type Props = {
  mappings: Mapping[];
  onEdit: (mapping: Mapping) => void;
  onDelete: (mappingId: string) => void;
  onSetPrimary: (mappingId: string) => void;
};

export function MappingsList({ mappings, onEdit, onDelete, onSetPrimary }: Props) {
  const primaryMapping = mappings.find((m) => m.isPrimary);
  const secondaryMappings = mappings.filter((m) => !m.isPrimary);

  const renderStrength = (strength: number) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= strength ? 'bg-indigo-500' : 'bg-gray-600'
          }`}
        />
      ))}
    </div>
  );

  const renderMappingCard = (mapping: Mapping, isPrimary: boolean) => (
    <div
      key={mapping.id}
      className={`
        bg-gray-900/50 border rounded-xl overflow-hidden
        ${isPrimary ? 'border-yellow-500/50' : 'border-gray-700'}
        ${mapping.talkIsDeleted ? 'opacity-60' : ''}
      `}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          {mapping.talkThumbnailUrl ? (
            <img
              src={mapping.talkThumbnailUrl}
              alt=""
              className="w-36 h-24 object-cover rounded flex-shrink-0"
            />
          ) : (
            <div className="w-36 h-24 bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
              <span className="text-xs text-gray-500">No image</span>
            </div>
          )}

          {/* Talk Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-gray-100 line-clamp-1">
                  {mapping.talkTitle}
                </h4>
                <p className="text-sm text-gray-400">
                  {mapping.talkSpeakerName}
                  {mapping.talkYear && ` (${mapping.talkYear})`}
                </p>
              </div>
              {isPrimary && (
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded text-yellow-400 text-xs flex-shrink-0">
                  <Star className="w-3 h-3" />
                  Primary
                </div>
              )}
            </div>

            {/* Strength indicator */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Strength:</span>
              {renderStrength(mapping.strength)}
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-300 leading-relaxed">
            {mapping.rationaleShort}
          </p>
          {mapping.rationaleLong && (
            <details className="mt-2">
              <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">
                Show extended rationale
              </summary>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {mapping.rationaleLong}
              </p>
            </details>
          )}
        </div>

        {/* Deleted Talk Warning */}
        {mapping.talkIsDeleted && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">
              This talk has been deleted. Consider removing this mapping.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-t border-gray-700">
        <a
          href={`/admin/talks/${mapping.talkId}/edit`}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
        >
          <Edit2 className="w-3 h-3" />
          Edit Talk
        </a>
        <div className="flex items-center gap-2">
          {!isPrimary && (
            <button
              onClick={() => onSetPrimary(mapping.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
              title="Set as primary"
            >
              <ArrowUp className="w-3 h-3" />
              Make Primary
            </button>
          )}
          <button
            onClick={() => onEdit(mapping)}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Edit mapping"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(mapping.id)}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Delete mapping"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Primary Mapping */}
      {primaryMapping && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-yellow-400 mb-3">
            <Star className="w-4 h-4" />
            Primary Mapping
          </h3>
          {renderMappingCard(primaryMapping, true)}
        </div>
      )}

      {/* Secondary Mappings */}
      {secondaryMappings.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Secondary Mappings ({secondaryMappings.length})
          </h3>
          <div className="space-y-4">
            {secondaryMappings.map((mapping) => renderMappingCard(mapping, false))}
          </div>
        </div>
      )}
    </div>
  );
}
