/// Flutter's [Text] widget only wraps at whitespace — a long, unbroken
/// string like an email address ("someone.with.a.long.name@example.com")
/// has no spaces for the layout engine to break at, so on a narrow phone
/// screen it gets clipped at the edge of its container instead of
/// wrapping to a second line. Inserting an invisible zero-width space
/// (`​`) after natural break points (`@`, each `.`) gives the text
/// layout engine somewhere safe to wrap without changing what's actually
/// displayed or copyable — the character has zero width and isn't a real
/// space, so nothing looks different when the text DOES fit on one line.
String breakableEmail(String email) {
  return email.replaceAll('@', '@​').replaceAll('.', '.​');
}
