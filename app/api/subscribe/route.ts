import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await resend.emails.send({
      from: "PegCheck <onboarding@resend.dev>",
      to: "matsblocknode1957@gmail.com",
      subject: "New PegCheck Alert Signup",
      html: `<p>New signup: <strong>${email}</strong></p><p>Add this to your alerts list.</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}