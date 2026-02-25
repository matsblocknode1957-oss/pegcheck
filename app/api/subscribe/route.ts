
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Save email to Supabase
    const { error } = await supabase
      .from("subscribers")
      .insert([{ email }]);

    if (error && error.code !== "23505") {
      // 23505 = duplicate email, we just ignore that
      console.error("Supabase error:", error);
    }

    // Notify you of new signup
    await resend.emails.send({
      from: "PegCheck <onboarding@resend.dev>",
      to: "matsblocknode1957@gmail.com",
      subject: "New PegCheck Alert Signup",
      html: `<p>New signup: <strong>${email}</strong></p>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}