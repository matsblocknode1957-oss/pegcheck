import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { Resend } = await import("resend");
    const { createClient } = await import("@supabase/supabase-js");

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabase
      .from("subscribers")
      .insert([{ email }]);

    if (error && error.code !== "23505") {
      console.error("Supabase error:", error);
    }

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
