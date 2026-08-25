const url = process.env.CHECK_URL || 'http://localhost:3000/api/subscriptions/check';
const secret = process.env.SUBSCRIPTIONS_RUN_SECRET || '';

(async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  });
  const data = await res.json();
  console.log('Check result:', data);
})();
