import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const CONTACT_RECIPIENT = process.env.CONTACT_RECEIVER_EMAIL?.trim() || 'newsloklens@gmail.com'

interface ContactPayload {
  firstName?: string
  lastName?: string
  mobileNumber?: string
  email?: string
  subject?: string
  message?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload

    const firstName = (body.firstName || '').trim()
    const lastName = (body.lastName || '').trim()
    const mobileNumber = (body.mobileNumber || '').trim()
    const senderEmail = (body.email || '').trim()
    const subject = (body.subject || '').trim()
    const message = (body.message || '').trim()

    if (!firstName || !lastName || !mobileNumber || !subject || !message) {
      return NextResponse.json(
        {
          ok: false,
          error: 'कृपया सभी आवश्यक फ़ील्ड भरें (Please fill in all required fields).',
        },
        { status: 400 },
      )
    }

    const fullName = `${firstName} ${lastName}`.trim()
    const emailSubject = `[LokLens Contact] ${subject} — ${fullName}`
    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim()
    const smtpUser = (process.env.SMTP_USER || CONTACT_RECIPIENT).trim()
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
    const smtpPort = Number(process.env.SMTP_PORT || 465)

    // 1. Primary transport: Direct SMTP via Nodemailer when SMTP_PASS / GMAIL_APP_PASSWORD is set
    if (smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })

      const plainText = [
        'New Contact Form Submission — LokLens News',
        '----------------------------------------',
        `Name          : ${fullName}`,
        `Mobile Number : ${mobileNumber}`,
        senderEmail ? `Email         : ${senderEmail}` : null,
        `Subject       : ${subject}`,
        `Submitted At  : ${submittedAt} (IST)`,
        '',
        'Message:',
        message,
      ]
        .filter((line) => line !== null)
        .join('\n')

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <div style="background: #0c548d; color: #ffffff; padding: 18px 24px;">
            <h2 style="margin: 0; font-size: 18px;">लोक Lens न्यूज़ — New Contact Message</h2>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Submitted on ${escapeHtml(submittedAt)} IST</p>
          </div>
          <div style="padding: 20px 24px; background: #ffffff; color: #16181d;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4b5563; width: 140px;">Name:</td>
                <td style="padding: 8px 0; color: #111827;">${escapeHtml(fullName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4b5563;">Mobile Number:</td>
                <td style="padding: 8px 0; color: #111827;"><a href="tel:${escapeHtml(mobileNumber)}" style="color: #0c548d; text-decoration: none;">${escapeHtml(mobileNumber)}</a></td>
              </tr>
              ${
                senderEmail
                  ? `<tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4b5563;">Email:</td>
                <td style="padding: 8px 0; color: #111827;"><a href="mailto:${escapeHtml(senderEmail)}" style="color: #0c548d; text-decoration: none;">${escapeHtml(senderEmail)}</a></td>
              </tr>`
                  : ''
              }
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #4b5563;">Subject:</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 600;">${escapeHtml(subject)}</td>
              </tr>
            </table>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              <div style="font-size: 13px; font-weight: 600; color: #4b5563; margin-bottom: 8px;">Message:</div>
              <div style="background: #f8fafc; padding: 14px; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1f2937;">${escapeHtml(message)}</div>
            </div>
          </div>
        </div>
      `

      await transporter.sendMail({
        from: `"LokLens News Contact" <${smtpUser}>`,
        to: CONTACT_RECIPIENT,
        replyTo: senderEmail || undefined,
        subject: emailSubject,
        text: plainText,
        html: htmlBody,
      })

      return NextResponse.json({
        ok: true,
        transport: 'smtp',
        recipient: CONTACT_RECIPIENT,
      })
    }

    // 2. Zero-config relay via FormSubmit AJAX endpoint to newsloklens@gmail.com
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://dev.loklensnews.com'
    const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_RECIPIENT)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: siteOrigin,
        Referer: `${siteOrigin}/contact`,
      },
      body: JSON.stringify({
        _subject: emailSubject,
        _template: 'table',
        _captcha: 'false',
        Name: fullName,
        'First Name': firstName,
        'Last Name': lastName,
        'Mobile Number': mobileNumber,
        ...(senderEmail ? { Email: senderEmail } : {}),
        Subject: subject,
        Message: message,
        'Submitted At (IST)': submittedAt,
      }),
    })

    if (formSubmitRes.ok) {
      const data = (await formSubmitRes.json().catch(() => ({}))) as { success?: string | boolean; message?: string }
      if (data.success === true || data.success === 'true') {
        return NextResponse.json({
          ok: true,
          transport: 'formsubmit',
          recipient: CONTACT_RECIPIENT,
        })
      }
    }

    // Inform client to use browser-side relay if server-side fetch was blocked by FormSubmit CSRF/origin rules
    return NextResponse.json({
      ok: true,
      transport: 'client-relay',
      recipient: CONTACT_RECIPIENT,
    })
  } catch (err) {
    console.error('[LokLens Contact API] Failed to send contact message:', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'संदेश भेजने में समस्या आई। कृपया पुनः प्रयास करें।',
      },
      { status: 500 },
    )
  }
}
