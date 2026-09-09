// Envoie une vraie notification push (via le service gratuit d'Expo) au
// téléphone d'un utilisateur, même si son app est fermée.
// Ne fonctionne que si l'utilisateur a une vraie app installée (pas Expo Go) -
// échoue silencieusement sinon, donc sans danger de l'appeler dès maintenant.
export async function sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, any>) {
  if (!pushToken) return; // pas de jeton = utilisateur pas encore sur une vraie app installée
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    // Échec silencieux : une notification ratée ne doit jamais faire planter
    // l'action principale (ex: la création d'une commande doit réussir même
    // si la notification, elle, échoue).
  }
}
