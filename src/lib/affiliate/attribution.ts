import { prisma } from "@/lib/prisma";

export async function attachAffiliateClickIfNeeded(
  userId: number,
  cookieId: string | undefined | null,
): Promise<{ attached: boolean; reason: string }> {
  if (!cookieId) {
    return { attached: false, reason: "no_cookie" };
  }

  try {
    const click = await prisma.affiliateClick.findFirst({
      where:   { cookieId },
      orderBy: { createdAt: "desc" },
      include: {
        affiliate: {
          select: { userId: true, status: true },
        },
      },
    });

    if (!click) {
      return { attached: false, reason: "click_not_found" };
    }

    if (click.expiresAt <= new Date()) {
      return { attached: false, reason: "expired" };
    }

    if (click.convertedToUserId === userId) {
      return { attached: true, reason: "already_attached" };
    }

    if (click.convertedToUserId !== null) {
      return { attached: false, reason: "already_attached_to_other_user" };
    }

    if (click.affiliate.status !== "approved") {
      return { attached: false, reason: "affiliate_not_approved" };
    }

    if (click.affiliate.userId === userId) {
      return { attached: false, reason: "self_referral" };
    }

    const registrant = await prisma.user.findUnique({
      where:  { id: userId },
      select: { registrationIpHash: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.affiliateClick.update({
        where: { id: click.id },
        data:  { convertedToUserId: userId },
      });

      await tx.user.update({
        where: { id: userId },
        data:  { referredByAffiliateId: click.affiliateId },
      });

      if (registrant?.registrationIpHash && registrant.registrationIpHash === click.ipHash) {
        await tx.affiliate.updateMany({
          where: { id: click.affiliateId, suspiciousFlag: false },
          data:  { suspiciousFlag: true, suspiciousReason: "ip_match_registration" },
        });
      }
    });

    return { attached: true, reason: "ok" };
  } catch (err) {
    console.warn("[AFFILIATE_ATTACH] attribution.ts error", err);
    return { attached: false, reason: "error" };
  }
}
