import type { Experiment } from '@uplift/shared';

/** The code customers paste in the <head> of their page. */
export function installCode(experiment: Experiment) {
  const lines = ['<!-- Uplift -->'];
  if (experiment.antiFlicker.enabled) {
    // Hides the page until the script has applied the variant, or the timeout passes.
    lines.push(
      '<style>.uplift-hide{opacity:0!important}</style>',
      `<script>(function(d,t){d.documentElement.classList.add('uplift-hide');setTimeout(function(){d.documentElement.classList.remove('uplift-hide')},t)})(document,${experiment.antiFlicker.timeoutMs})</script>`,
    );
  }
  lines.push(`<script src="${experiment.snippetUrl}" async></script>`);
  return lines.join('\n');
}
