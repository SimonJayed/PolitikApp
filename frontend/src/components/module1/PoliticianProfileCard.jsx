import React from 'react';

function initialsFor(name) {
  if (!name) return 'P';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function PoliticianProfileCard({ profile, variant = 'details' }) {
  if (!profile) return null;

  const showAvatar = variant !== 'simple';

  return (
    <article className={`politician-profile-card ${variant}`}>
      <div className="profileSummary">
        {showAvatar && (
          <span className="detailsAvatar" style={{ marginBottom: '16px', display: 'inline-block' }}>
            {profile.profileImageUrl ? (
              <img alt={profile.fullName} src={profile.profileImageUrl} style={{ width: '88px', height: '88px', borderRadius: '12px', objectFit: 'cover' }} />
            ) : (
              <span className="avatar-initials-placeholder" style={{ display: 'grid', placeItems: 'center', width: '88px', height: '88px', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--ph-blue)', fontWeight: 'bold', fontSize: '24px' }}>
                {initialsFor(profile.fullName)}
              </span>
            )}
          </span>
        )}
        <div className="profile-identity-block">
          <p className="eyebrow ty-page-kicker">{profile.position || 'UNSPECIFIED POSITION'}</p>
          <h2 className="ty-section-title" style={{ marginTop: '4px', marginBottom: '8px' }}>{profile.fullName}</h2>
          <p className="ty-body"><strong>Jurisdiction:</strong> {profile.jurisdiction || 'Unspecified'}</p>
          <p className="ty-body"><strong>Party Affiliation:</strong> {profile.partyAffiliation || 'Party not disclosed'}</p>
          {profile.termStart && profile.termEnd && (
            <p className="ty-meta" style={{ marginTop: '6px' }}>
              <strong>Term:</strong> {new Date(profile.termStart).toLocaleDateString()} - {new Date(profile.termEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
