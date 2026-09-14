/* Client-facing steps, in service order. Keep existing IDs stable. */

export const protocolStages = [
    {
        id: 'recon',
        name: 'Your priorities',
        heading: 'Start with what matters to you.',
        body: 'You may be worried about your family, your guests, your staff, or a property you cannot watch around the clock. Tell us what is happening and what would help you feel more confident. We review your location, schedule, and concerns before recommending coverage.',
        expectations: [
            'A conversation about your concerns and the people or property you want to protect.',
            'A review of your location, entrances, and areas that need extra attention.',
            'Guidance on the type of security that fits your situation.'
        ],
        cta: 'Tell Us What You Need'
    },
    {
        id: 'post-orders',
        name: 'Your plan',
        heading: 'A plan that fits your life and your business.',
        body: 'Good security should support your day, not get in the way of it. We work with you to decide where officers are needed, how they should interact with people, and what to do if a concern comes up. You review the plan so expectations are clear before coverage begins.',
        expectations: [
            'Clear responsibilities, coverage hours, and access arrangements.',
            'An officer presence that suits your setting, from discreet to highly visible.',
            'An agreed approach to handling concerns calmly and keeping you informed.'
        ],
        cta: 'Plan Your Coverage'
    },
    {
        id: 'dispatch',
        name: 'Your protection',
        heading: 'A prepared team, so you can focus.',
        body: 'Whether you are hosting guests, running a business, or protecting a private space, you need officers who understand the job. Your team is briefed on your location and the agreed plan before coverage starts, with attention to both safety and the way people are treated.',
        expectations: [
            'Officers with the licensing appropriate to the security service you choose.',
            'A team that understands your priorities, site rules, and assigned responsibilities.',
            'Professional, respectful interactions with your guests, staff, and visitors.'
        ],
        cta: 'Arrange Your Security'
    },
    {
        id: 'telemetry',
        name: 'Your updates',
        heading: 'Know what happened without chasing answers.',
        body: 'You should not have to guess how your security coverage went. Clear shift summaries and incident reports help you understand the work completed, any concerns that came up, and what may need your attention next.',
        expectations: [
            'A record of patrols and the work completed during your coverage.',
            'Clear reports when an incident or concern needs your attention.',
            'Information you can use to review your coverage and plan next steps.'
        ],
        cta: 'Discuss Ongoing Coverage'
    }
];
