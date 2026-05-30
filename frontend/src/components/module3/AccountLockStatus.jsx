import React from 'react';

export default function AccountLockStatus({ rejectionLocked, rejectionRate }) {
  if (!rejectionLocked) return null;

  return (
    <section className="matrixLockoutCard">
      <strong>Automatic Contributor Lockout Active</strong>
      <span>
        Lifetime rejection rate is {Number(rejectionRate || 0).toFixed(1)}%. The sandbox account status has been switched to SUSPENDED.
      </span>
    </section>
  );
}
