(() => {
  const entries = [...document.querySelectorAll(".forum-entry")];
  if (!entries.length || !window.GuatForumWs) return;

  window.GuatForumWs.connect({ timeout: 1400 })
    .then(async (client) => {
      await client.request("hello").catch(() => null);
      entries.forEach((entry) => {
        entry.hidden = false;
      });
      client.close();
    })
    .catch(() => {
      entries.forEach((entry) => {
        entry.hidden = true;
      });
    });
})();
