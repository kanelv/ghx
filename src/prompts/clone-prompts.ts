export interface ClonePreviewDetails {
  alias: string;
  repository: string;
  destination: string;
  maskedUrl: string;
}

export interface PromptCloneConfirmationDependencies {
  select?: <T>(config: any) => Promise<T>;
  logger?: {
    log: (msg: string) => void;
  };
}

export async function promptCloneConfirmation(
  preview: ClonePreviewDetails,
  deps?: PromptCloneConfirmationDependencies,
): Promise<boolean> {
  const logger = deps?.logger ?? console;

  logger.log(`\nSelected account: ${preview.alias}`);
  logger.log(`Repository:       ${preview.repository}`);
  logger.log(`Destination:      ${preview.destination}`);
  logger.log(`\nCommand preview (PAT masked):`);
  logger.log(`  git clone ${preview.maskedUrl}\n`);

  let selectFn = deps?.select;
  if (!selectFn) {
    const inquirer = await import('@inquirer/prompts');
    selectFn = inquirer.select;
  }

  try {
    const answer = await selectFn<boolean>({
      message: 'Do you want me to run this command now?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
      default: false,
    });

    return answer === true;
  } catch {
    // Escape or interruption (Ctrl+C / force close) cancels the clone
    return false;
  }
}
