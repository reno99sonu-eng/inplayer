import { redirect } from "next/navigation";

// MilonBook is the product name for what the code still routes as
// /messages. The old path is kept as the real one — every existing deep
// link, push notification and "Back to MilonBook" link already points at
// it, and changing the route would break all of them for no user-visible
// gain. This alias exists so the name people now see also works as a URL
// they can type or share.
export default function MilonBookAlias() {
  redirect("/messages");
}
