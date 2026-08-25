import { Notification } from "@/models/Notification";


export async function createNotification(params: {
  userId: string;
  type: "comment" | "business" | "listing" | "offer" | "question" | "report";
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    await Notification.create({
      user: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || "",
      link: params.link || "",
    });
  } catch (error) {

    console.error("createNotification failed:", error);
  }
}
