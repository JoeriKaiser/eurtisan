// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ProductNewImageUploader } from '../product/ProductNewImageUploader'
import { Badge } from './badge'
import { Button } from './button'
import { FeedbackBanner } from './FeedbackBanner'
import { Input } from './input'
import { Select } from './select'
import { Textarea } from './textarea'

describe('form and asynchronous-state accessibility', () => {
  it('associates localized names, requirements, descriptions, and errors', async () => {
    const { container } = render(
      <form>
        <label htmlFor='title'>Product title</label>
        <p id='title-hint'>Use the public listing name.</p>
        <Input
          id='title'
          required
          error='A product title is required.'
          aria-describedby='title-hint title-error'
        />
        <p id='title-error' role='alert'>
          A product title is required.
        </p>

        <label htmlFor='category'>Category</label>
        <Select id='category' required error='Choose a category.' defaultValue=''>
          <option value=''>Choose a category</option>
          <option value='ceramics'>Ceramics</option>
        </Select>
        <p id='category-error' role='alert'>
          Choose a category.
        </p>

        <label htmlFor='description'>Description</label>
        <Textarea id='description' required error='Describe this product.' />
        <p id='description-error' role='alert'>
          Describe this product.
        </p>
      </form>,
    )

    const title = screen.getByRole('textbox', { name: 'Product title' })
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(title.getAttribute('aria-errormessage')).toBe('title-error')
    expect(title.hasAttribute('required')).toBe(true)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('announces loading, success, and error states without color-only meaning', async () => {
    const { container } = render(
      <div>
        <Button isLoading>Save listing</Button>
        <FeedbackBanner type='success' message='Listing saved.' />
        <FeedbackBanner type='error' message='The listing could not be saved.' />
        <Badge variant='success' role='status'>
          Paid
        </Badge>
      </div>,
    )

    expect(screen.getByRole('button', { name: /Save listing/ }).getAttribute('aria-busy')).toBe(
      'true',
    )
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('alert').textContent).toContain('could not be saved')
    expect(screen.getByText('Paid').textContent).toBe('Paid')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('keeps upload input named, error-associated, keyboard-triggerable, and announced', async () => {
    const onImageSelect = vi.fn()
    const { container } = render(
      <ProductNewImageUploader
        images={[]}
        maxImages={5}
        fieldError='Add at least one product image.'
        onImageSelect={onImageSelect}
        onRemoveImage={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('Product images') as HTMLInputElement
    const trigger = screen.getByRole('button', { name: 'Add images' })
    const click = vi.spyOn(input, 'click')
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)

    expect(click).toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('-error')
    expect(screen.getByRole('alert').textContent).toContain('Add at least one')
    expect(await axe(container)).toHaveNoViolations()
  })
})
