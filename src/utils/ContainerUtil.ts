import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

export function buildContainerHeader(
  title: string,
  description: string,
  thumbnailUrl?: string,
  thumbnailDescription?: string,
) {
  const container = new ContainerBuilder();

  if (thumbnailUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${title}\n${description}`),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(thumbnailUrl)
            .setDescription(thumbnailDescription ?? `${title} thumbnail`),
        ),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}\n${description}`),
    );
  }

  return container;
}

export function buildErrorContainer(title: string, description: string) {
  return new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${title}\n${description}`),
  );
}
